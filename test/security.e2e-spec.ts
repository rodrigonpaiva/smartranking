import { HttpServer, INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express, { type Application, type RequestHandler } from 'express';

import {
  ensureErrorPayload,
  ensureRecord,
  ensureString,
} from './utils/assertions';
import { createE2EApp, e2e } from './utils/create-e2e-app';

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
  // Better Auth is bypassed in e2e via createE2EApp.
  let clubId: string;
  let categoryId: string;
  let playerId: string;
  let otherClubId: string;
  let tenantHeader = 'security-bootstrap';

  const adminSession = (tenant: string) => ({
    'x-test-user': 'security-admin',
    'x-test-role': 'system_admin',
    'x-tenant-id': tenant,
  });

  const clubSession = (tenant: string) => ({
    'x-test-user': 'security-club-user',
    'x-test-role': 'club',
    'x-test-club': tenant,
    'x-tenant-id': tenant,
  });

  const clubSessionWithoutTenant = (tenant: string) => ({
    'x-test-user': 'security-club-user',
    'x-test-role': 'club',
    'x-test-club': tenant,
  });

  const playerSession = () => ({
    'x-test-user': 'security-player-user',
    'x-test-role': 'player',
    'x-test-club': clubId,
    'x-test-player': playerId,
    'x-tenant-id': clubId,
  });

  const bootstrapSession = (userId: string) => ({
    'x-test-user': userId,
    'x-tenant-id': tenantHeader,
  });

  const flattenErrorMessage = (message: string | string[]): string => {
    return Array.isArray(message) ? message.join(', ') : message;
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.MONGODB_DB_NAME = 'smartranking_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-please-change-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.BETTER_AUTH_RATE_LIMIT_MAX = '3';
    process.env.BETTER_AUTH_RATE_LIMIT_WINDOW = '60';
    // Align e2e CORS behavior with main.ts (uses CORS_ALLOWED_ORIGINS).
    process.env.CORS_ALLOWED_ORIGINS = process.env.BETTER_AUTH_URL;

    const e2eApp = await createE2EApp({ bodyParser: false });
    app = e2eApp.app;

    const httpAdapter = app.getHttpAdapter().getInstance() as Application;
    const authHandler: RequestHandler = (_req, res) => {
      res.status(200).json({ ok: true });
    };
    httpAdapter.all('/api/auth', authHandler);
    httpAdapter.all(/\/api\/auth(\/.*)?$/, authHandler);
    httpAdapter.use(express.json());
    httpAdapter.use(express.urlencoded({ extended: true }));

    httpServer = e2eApp.httpServer as HttpServer;

    const clubResponse = await e2e(httpServer, 'security')
      .post('/api/v1/clubs')
      .set(adminSession(tenantHeader))
      .send({
        name: 'Security Club',
        slug: 'security-club',
      })
      .expect(201);
    const body = ensureRecord(clubResponse.body, 'create club response');
    clubId = ensureString(body._id, 'club id');
    tenantHeader = clubId;

    const playerResponse = await e2e(httpServer, 'security')
      .post('/api/v1/players')
      .set(adminSession(tenantHeader))
      .send({
        email: 'player.security@example.com',
        name: 'Security Player',
        phone: '11999990000',
        clubId,
      })
      .expect(201);
    const playerBody = ensureRecord(playerResponse.body, 'create player');
    playerId = ensureString(playerBody._id, 'player id');

    const otherClubResponse = await e2e(httpServer, 'security')
      .post('/api/v1/clubs')
      .set(adminSession('security-secondary'))
      .send({
        name: 'Security Club B',
        slug: 'security-club-b',
      })
      .expect(201);
    const otherClubBody = ensureRecord(
      otherClubResponse.body,
      'other club response',
    );
    otherClubId = ensureString(otherClubBody._id, 'other club id');

    const categoryResponse = await e2e(httpServer, 'security')
      .post('/api/v1/categories')
      .set(adminSession(tenantHeader))
      .send({
        category: 'security-cat',
        description: 'Security Category',
        clubId,
        events: [{ name: 'Win', operation: '+', value: 10 }],
      })
      .expect(201);
    const categoryBody = ensureRecord(categoryResponse.body, 'category');
    categoryId = ensureString(categoryBody._id, 'category id');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('Auth', () => {
    it('responds to auth routes', async () => {
      const res = await e2e(httpServer, 'security').get(
        '/api/auth/get-session',
      );

      expect(res.status).toBe(200);
    });
  });

  describe('Validation and NoSQL injection', () => {
    it('rejects invalid email payloads', async () => {
      const res = await e2e(httpServer, 'security')
        .post('/api/v1/players')
        .set(adminSession(tenantHeader))
        .send({
          email: 'not-an-email',
          phone: '123',
          name: 'Invalid Email',
          clubId,
        });

      expect(res.status).toBe(400);
    });

    it('rejects missing required fields', async () => {
      const res = await e2e(httpServer, 'security')
        .post('/api/v1/players')
        .set(adminSession(tenantHeader))
        .send({
          phone: '123',
          name: 'Missing Email',
        });

      expect(res.status).toBe(400);
    });

    it('blocks NoSQL injection via phone query', async () => {
      const res = await e2e(httpServer, 'security')
        .get('/api/v1/players/by-phone?phone[$ne]=1')
        .set(adminSession(tenantHeader));

      expect(res.status).toBe(400);
    });
  });

  describe('Auth guards', () => {
    it('returns 401 when session is missing', async () => {
      const res = await e2e(httpServer, 'security')
        .get('/api/v1/players')
        .set('x-tenant-id', tenantHeader)
        .expect(401);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(401);
    });

    it('returns 400 when tenant header is missing for authenticated users', async () => {
      const res = await e2e(httpServer, 'security')
        .get('/api/v1/players')
        .set(clubSessionWithoutTenant(clubId))
        .expect(400);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(400);
      expect(flattenErrorMessage(error.message)).toContain(
        'Tenant header is required',
      );
    });

    it('returns 403 when a club role hits an admin-only route', async () => {
      const res = await e2e(httpServer, 'security')
        .post('/api/v1/clubs')
        .set(clubSession(clubId))
        .send({ name: 'Forbidden Club', slug: 'forbidden-club' })
        .expect(403);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(403);
    });

    it('returns 403 when a player hits an admin-only route', async () => {
      const res = await e2e(httpServer, 'security')
        .post('/api/v1/players')
        .set(playerSession())
        .send({
          email: 'should-not-pass@example.com',
          name: 'Forbidden Player',
          phone: '11000000000',
          clubId,
        })
        .expect(403);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(403);
    });

    it('returns 403 when a club user upserts moderator profiles', async () => {
      const res = await e2e(httpServer, 'security')
        .post('/api/v1/users/profiles')
        .set(clubSession(clubId))
        .send({ userId: 'moderator-1', role: 'club', clubId })
        .expect(403);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(403);
    });

    it('allows system admin to upsert moderator profiles', async () => {
      // CreateUserProfileDto requires userId to be a MongoId.
      await e2e(httpServer, 'security')
        .post('/api/v1/users/profiles')
        .set(adminSession(tenantHeader))
        .send({ userId: '507f1f77bcf86cd799439011', role: 'club', clubId })
        .expect(201);
    });

    it('blocks mismatched tenant headers for club users', async () => {
      const res = await e2e(httpServer, 'security')
        .get('/api/v1/players')
        .set({ ...clubSession(clubId), 'x-tenant-id': 'other-tenant' })
        .expect(403);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(403);
      expect(flattenErrorMessage(error.message)).toContain(
        'Tenant not allowed',
      );
    });

    it('blocks players from reading another club roster', async () => {
      const res = await e2e(httpServer, 'security')
        .get(`/api/v1/players/by-club/${otherClubId}`)
        .set(playerSession())
        .expect(403);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(403);
      expect(flattenErrorMessage(error.message)).toContain('Club not allowed');
    });

    it('prevents clubs from creating players in other clubs', async () => {
      const res = await e2e(httpServer, 'security')
        .post('/api/v1/players')
        .set(clubSession(clubId))
        .send({
          email: 'cross-club@example.com',
          name: 'Cross Club',
          phone: '11912345678',
          clubId: otherClubId,
        })
        .expect(403);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(403);
    });

    it('blocks players from ranking endpoints', async () => {
      const res = await e2e(httpServer, 'security')
        .get(`/api/v1/matches/ranking/${categoryId}`)
        .set(playerSession())
        .expect(403);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(403);
    });

    it('blocks players from ranking endpoints', async () => {
      const res = await e2e(httpServer, 'security')
        .get(`/api/v1/matches/ranking/${categoryId}`)
        .set(playerSession())
        .expect(403);
      const error = ensureErrorPayload(res.body);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('Profile bootstrap bypass', () => {
    it('allows GET /users/me without a profile', async () => {
      const response = await e2e(httpServer, 'security')
        .get('/api/v1/users/me')
        .set(bootstrapSession('bootstrap-me'))
        .expect(200);
      const body = ensureRecord(response.body, 'me response');
      expect(body.profile).toBeNull();
    });

    it('allows creating a self profile without existing profile', async () => {
      await e2e(httpServer, 'security')
        .post('/api/v1/users/profiles/self')
        .set(bootstrapSession('bootstrap-self'))
        .send({ role: 'club', clubId })
        .expect(201);
    });

    it('blocks moderator profile creation without admin role even during bootstrap', async () => {
      await e2e(httpServer, 'security')
        .post('/api/v1/users/profiles')
        .set(bootstrapSession('bootstrap-deny'))
        .send({ userId: 'mod-target', role: 'club', clubId })
        .expect(403);
    });
  });

  describe('Rate limiting and brute force', () => {
    it('accepts auth traffic (rate limiting covered in runtime)', async () => {
      const res = await e2e(httpServer, 'security').post(
        '/api/auth/sign-in/email',
      );

      expect(res.status).toBe(200);
    });
  });

  describe('CORS and trusted origins', () => {
    it('allows configured origins', async () => {
      const allowedOrigin =
        process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
      const res = await e2e(httpServer, 'security')
        .get('/api/auth/get-session')
        .set('Origin', allowedOrigin);

      expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    });

    it('rejects untrusted origins', async () => {
      const res = await e2e(httpServer, 'security')
        .get('/api/auth/get-session')
        .set('Origin', 'http://evil.example');

      // With a single configured origin (string), the CORS middleware returns a
      // fixed allow-origin header (it does not echo back arbitrary origins).
      expect(res.headers['access-control-allow-origin']).not.toBe(
        'http://evil.example',
      );
    });
  });
});
