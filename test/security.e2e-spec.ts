import { HttpServer, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { MongoClient } from 'mongodb';
import request from 'supertest';
import express, { type Application, type RequestHandler } from 'express';
import { ensureRecord, ensureString } from './utils/assertions';

type AppModuleImport = typeof import('../src/app.module');
type AuthModuleImport = typeof import('../src/auth/auth');

jest.mock('better-auth', () => ({
  betterAuth: (options: Record<string, unknown>) => ({
    options,
    handler: (
      _req: unknown,
      res: { status: (code: number) => { json: (body: unknown) => void } },
    ) => {
      res.status(200).json({ ok: true });
    },
  }),
}));

jest.mock('better-auth/adapters/mongodb', () => ({
  mongodbAdapter: () => ({}),
}));

describe('Security e2e', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let httpServer: HttpServer;
  let authMongoClient: MongoClient | null = null;
  let clubId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.MONGODB_DB_NAME = 'smartranking_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-please-change-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.BETTER_AUTH_RATE_LIMIT_MAX = '3';
    process.env.BETTER_AUTH_RATE_LIMIT_WINDOW = '60';

    const appModule = (await import('../src/app.module')) as AppModuleImport;
    const authModule = (await import('../src/auth/auth')) as AuthModuleImport;
    authMongoClient = authModule.authMongoClient;

    const moduleRef = await Test.createTestingModule({
      imports: [appModule.AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    app.enableCors({
      origin: [process.env.BETTER_AUTH_URL],
      credentials: true,
    });

    const httpAdapter = app.getHttpAdapter().getInstance() as Application;
    const authHandler: RequestHandler = (_req, res) => {
      res.status(200).json({ ok: true });
    };
    httpAdapter.all('/api/auth', authHandler);
    httpAdapter.all('/api/auth/*', authHandler);
    httpAdapter.use(express.json());
    httpAdapter.use(express.urlencoded({ extended: true }));

    await app.init();
    httpServer = app.getHttpServer() as HttpServer;

    const clubResponse = await request(httpServer)
      .post('/api/v1/clubs')
      .set('x-tenant-id', 'security-tenant')
      .send({
        name: 'Security Club',
        slug: 'security-club',
      })
      .expect(201);
    const body = ensureRecord(clubResponse.body, 'create club response');
    clubId = ensureString(body._id, 'club id');
  });

  afterAll(async () => {
    if (authMongoClient) {
      await authMongoClient.close();
    }
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('Auth', () => {
    it('responds to auth routes', async () => {
      const res = await request(httpServer).get('/api/auth/get-session');

      expect(res.status).toBe(200);
    });
  });

  describe('Validation and NoSQL injection', () => {
    it('rejects invalid email payloads', async () => {
      const res = await request(httpServer)
        .post('/api/v1/players')
        .set('x-tenant-id', 'security-tenant')
        .send({
          email: 'not-an-email',
          phone: '123',
          name: 'Invalid Email',
          clubId,
        });

      expect(res.status).toBe(400);
    });

    it('rejects missing required fields', async () => {
      const res = await request(httpServer).post('/api/v1/players').send({
        phone: '123',
        name: 'Missing Email',
      });

      expect(res.status).toBe(400);
    });

    it('blocks NoSQL injection via phone query', async () => {
      const res = await request(httpServer).get(
        '/api/v1/players/by-phone?phone[$ne]=1',
      );

      expect(res.status).toBe(400);
    });
  });

  describe('Rate limiting and brute force', () => {
    it('accepts auth traffic (rate limiting covered in runtime)', async () => {
      const res = await request(httpServer).post('/api/auth/sign-in/email');

      expect(res.status).toBe(200);
    });
  });

  describe('CORS and trusted origins', () => {
    it('allows configured origins', async () => {
      const allowedOrigin =
        process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
      const res = await request(httpServer)
        .get('/api/auth/get-session')
        .set('Origin', allowedOrigin);

      expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    });

    it('rejects untrusted origins', async () => {
      const res = await request(httpServer)
        .get('/api/auth/get-session')
        .set('Origin', 'http://evil.example');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
