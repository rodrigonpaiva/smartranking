import { HttpServer, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { MongoClient } from 'mongodb';
import request from 'supertest';

import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import {
  ensureArray,
  ensureErrorPayload,
  ensureRecord,
  ensureString,
} from './utils/assertions';

type AppModuleImport = typeof import('../src/app.module');
type AuthModuleImport = typeof import('../src/auth/auth');

jest.setTimeout(30000);

jest.mock('better-auth', () => ({
  betterAuth: (options: Record<string, unknown>) => ({
    options,
    handler: (
      _req: unknown,
      res: { status: (code: number) => { end: () => void } },
    ) => {
      res.status(200).end();
    },
  }),
}));

jest.mock('better-auth/adapters/mongodb', () => ({
  mongodbAdapter: () => ({}),
}));

describe('SmartRanking API (e2e)', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let httpServer: HttpServer;
  let createdPlayerId: string;
  let authMongoClient: MongoClient | null = null;
  let clubId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      instance: { ip: '127.0.0.1', port: 27018 },
    });
    const uri = mongo.getUri('smartranking-e2e');

    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = 'smartranking-e2e';
    process.env.PORT = '0';
    process.env.BETTER_AUTH_SECRET = 'test-secret-please-change-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';

    const appModule = (await import('../src/app.module')) as AppModuleImport;
    const authModule = (await import('../src/auth/auth')) as AuthModuleImport;
    authMongoClient = authModule.authMongoClient;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule.AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    httpServer = app.getHttpServer() as HttpServer;

    const clubResponse = await request(httpServer)
      .post('/api/v1/clubs')
      .set('x-tenant-id', 'test-tenant')
      .send({
        name: 'Pedal Club',
        slug: 'pedal-club',
        city: 'Sao Paulo',
        state: 'SP',
      })
      .expect(201);
    const clubBody = ensureRecord(clubResponse.body, 'create club response');
    clubId = ensureString(clubBody._id, 'club id');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (authMongoClient) {
      await authMongoClient.close();
    }

    if (mongo) {
      await mongo.stop();
    }
  });

  describe('Players endpoints', () => {
    const getPlayerPayload = () => ({
      email: 'player.one@example.com',
      name: 'Player One',
      phone: '11999999999',
      clubId,
    });

    it('creates a new player', async () => {
      const response = await request(httpServer)
        .post('/api/v1/players')
        .set('x-tenant-id', 'test-tenant')
        .send(getPlayerPayload())
        .expect(201);

      const body = ensureRecord(response.body, 'create player response');
      const payload = getPlayerPayload();
      expect(body).toMatchObject({
        email: payload.email,
        name: payload.name,
        phone: payload.phone,
      });
      createdPlayerId = ensureString(body._id, 'created player id');
    });

    it('rejects duplicated player emails', async () => {
      const response = await request(httpServer)
        .post('/api/v1/players')
        .set('x-tenant-id', 'test-tenant')
        .send(getPlayerPayload())
        .expect(400);

      const error = ensureErrorPayload(response.body);
      const message = ensureString(error.message, 'error message');
      expect(message).toContain('already exists');
    });

    it('returns all players', async () => {
      const response = await request(httpServer)
        .get('/api/v1/players')
        .set('x-tenant-id', 'test-tenant')
        .expect(200);

      const players = ensureArray(response.body, 'players list');
      expect(players).toHaveLength(1);
    });

    it('fetches a player by id', async () => {
      const response = await request(httpServer)
        .get(`/api/v1/players/${createdPlayerId}`)
        .set('x-tenant-id', 'test-tenant')
        .expect(200);

      const body = ensureRecord(response.body, 'player details response');
      expect(body).toMatchObject({
        _id: createdPlayerId,
        email: getPlayerPayload().email,
      });
    });

    it('updates a player and reflects changes on the next fetch', async () => {
      const updatePayload = {
        name: 'Player One Updated',
        phone: '11888888888',
      };

      await request(httpServer)
        .put(`/api/v1/players/${createdPlayerId}`)
        .set('x-tenant-id', 'test-tenant')
        .send(updatePayload)
        .expect(200);

      const response = await request(httpServer)
        .get(`/api/v1/players/${createdPlayerId}`)
        .set('x-tenant-id', 'test-tenant')
        .expect(200);

      const body = ensureRecord(response.body, 'updated player response');
      expect(body).toMatchObject({
        name: updatePayload.name,
        phone: updatePayload.phone,
      });
    });

    it('finds a player by phone number', async () => {
      const response = await request(httpServer)
        .get('/api/v1/players/by-phone')
        .set('x-tenant-id', 'test-tenant')
        .query({ phone: '11888888888' })
        .expect(200);

      const body = ensureRecord(response.body, 'player by phone response');
      expect(ensureString(body._id, 'player id')).toBe(createdPlayerId);
    });

    it('deletes a player', async () => {
      await request(httpServer)
        .delete(`/api/v1/players/${createdPlayerId}`)
        .set('x-tenant-id', 'test-tenant')
        .expect(200);
    });

    it('returns 404 when fetching a deleted player', async () => {
      const response = await request(httpServer)
        .get(`/api/v1/players/${createdPlayerId}`)
        .set('x-tenant-id', 'test-tenant')
        .expect(404);

      const error = ensureErrorPayload(response.body);
      const message = ensureString(error.message, 'error message');
      expect(message).toContain('No players found');
    });
  });

  describe('Categories endpoints', () => {
    const getCategoryPayload = () => ({
      category: 'A',
      description: 'Category A',
      events: [{ name: 'Match victory', operation: '+', value: 10 }],
      clubId,
    });
    let categoryPlayerId: string;

    beforeAll(async () => {
      const response = await request(httpServer)
        .post('/api/v1/players')
        .set('x-tenant-id', 'test-tenant')
        .send({
          email: 'player.two@example.com',
          name: 'Player Two',
          phone: '11777777777',
          clubId,
        })
        .expect(201);

      const body = ensureRecord(response.body, 'category player response');
      categoryPlayerId = ensureString(body._id, 'category player id');
    });

    it('validates payload when creating a category', async () => {
      const response = await request(httpServer)
        .post('/api/v1/categories')
        .set('x-tenant-id', 'test-tenant')
        .send({ category: 'invalid', description: '', events: [], clubId })
        .expect(400);

      const error = ensureErrorPayload(response.body);
      expect(Array.isArray(error.message)).toBe(true);
    });

    it('creates a category', async () => {
      const response = await request(httpServer)
        .post('/api/v1/categories')
        .set('x-tenant-id', 'test-tenant')
        .send(getCategoryPayload())
        .expect(201);

      const body = ensureRecord(response.body, 'create category response');
      const categoryPayload = getCategoryPayload();
      expect(body).toMatchObject({
        category: categoryPayload.category,
        description: categoryPayload.description,
      });
      const events = ensureArray(body.events, 'category events');
      expect(events).toHaveLength(1);
    });

    it('lists all categories', async () => {
      const response = await request(httpServer)
        .get('/api/v1/categories')
        .set('x-tenant-id', 'test-tenant')
        .expect(200);

      const categories = ensureArray(response.body, 'categories');
      expect(categories.length).toBeGreaterThanOrEqual(1);
    });

    it('fetches a category by its code', async () => {
      const response = await request(httpServer)
        .get(`/api/v1/categories/${getCategoryPayload().category}`)
        .set('x-tenant-id', 'test-tenant')
        .expect(200);

      const body = ensureRecord(response.body, 'category details response');
      expect(ensureString(body.category, 'category code')).toBe(
        getCategoryPayload().category,
      );
    });

    it('assigns a player to the category', async () => {
      await request(httpServer)
        .post(
          `/api/v1/categories/${getCategoryPayload().category}/players/${categoryPlayerId}`,
        )
        .set('x-tenant-id', 'test-tenant')
        .expect(201);
    });

    it('prevents duplicated player assignments', async () => {
      const response = await request(httpServer)
        .post(
          `/api/v1/categories/${getCategoryPayload().category}/players/${categoryPlayerId}`,
        )
        .set('x-tenant-id', 'test-tenant')
        .expect(400);

      const error = ensureErrorPayload(response.body);
      const message = ensureString(error.message, 'error message');
      expect(message).toContain('already assigned');
    });

    it('returns the category with assigned players populated', async () => {
      const response = await request(httpServer)
        .get('/api/v1/categories')
        .set('x-tenant-id', 'test-tenant')
        .expect(200);

      const categories = ensureArray(response.body, 'categories list').map(
        (item, index) => ensureRecord(item, `category item ${index}`),
      );
      const category = categories.find(
        (item) =>
          ensureString(item.category, 'category code') ===
          getCategoryPayload().category,
      );
      if (!category) {
        throw new Error('Category not found in response');
      }
      const players = ensureArray(category.players, 'category players');
      expect(players).toHaveLength(1);
      const firstPlayer = ensureRecord(players[0], 'category player');
      expect(ensureString(firstPlayer._id, 'player id')).toBe(categoryPlayerId);
    });
  });
});
