import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { AppModule } from '../src/app.module';

jest.setTimeout(30000);

describe('SmartRanking API (e2e)', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let httpServer: any;
  let createdPlayerId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      instance: { ip: '127.0.0.1', port: 27018 },
    });
    const uri = mongo.getUri('smartranking-e2e');

    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = 'smartranking-e2e';
    process.env.PORT = '0';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (mongo) {
      await mongo.stop();
    }
  });

  describe('Players endpoints', () => {
    const payload = {
      email: 'player.one@example.com',
      name: 'Player One',
      phone: '11999999999',
    };

    it('creates a new player', async () => {
      const { body } = await request(httpServer)
        .post('/api/v1/players')
        .send(payload)
        .expect(201);

      expect(body).toMatchObject({ email: payload.email, name: payload.name, phone: payload.phone });
      expect(body).toHaveProperty('_id');
      createdPlayerId = body._id;
    });

    it('rejects duplicated player emails', async () => {
      const { body } = await request(httpServer)
        .post('/api/v1/players')
        .send(payload)
        .expect(400);

      expect(body.error.message).toContain('already exists');
    });

    it('returns all players', async () => {
      const { body } = await request(httpServer)
        .get('/api/v1/players')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
    });

    it('fetches a player by id', async () => {
      const { body } = await request(httpServer)
        .get(`/api/v1/players/${createdPlayerId}`)
        .expect(200);

      expect(body).toMatchObject({ _id: createdPlayerId, email: payload.email });
    });

    it('updates a player and reflects changes on the next fetch', async () => {
      const updatePayload = { name: 'Player One Updated', phone: '11888888888' };

      await request(httpServer)
        .put(`/api/v1/players/${createdPlayerId}`)
        .send(updatePayload)
        .expect(200);

      const { body } = await request(httpServer)
        .get(`/api/v1/players/${createdPlayerId}`)
        .expect(200);

      expect(body).toMatchObject({ name: updatePayload.name, phone: updatePayload.phone });
    });

    it('finds a player by phone number', async () => {
      const { body } = await request(httpServer)
        .get('/api/v1/players/by-phone')
        .query({ phone: '11888888888' })
        .expect(200);

      expect(body._id).toBe(createdPlayerId);
    });

    it('deletes a player', async () => {
      await request(httpServer)
        .delete(`/api/v1/players/${createdPlayerId}`)
        .expect(200);
    });

    it('returns 404 when fetching a deleted player', async () => {
      const { body } = await request(httpServer)
        .get(`/api/v1/players/${createdPlayerId}`)
        .expect(404);

      expect(body.error.message).toContain('No players found');
    });
  });

  describe('Categories endpoints', () => {
    const categoryPayload = {
      category: 'A',
      description: 'Category A',
      events: [{ name: 'Match victory', operation: '+', value: 10 }],
    };
    let categoryPlayerId: string;

    beforeAll(async () => {
      const { body } = await request(httpServer)
        .post('/api/v1/players')
        .send({
          email: 'player.two@example.com',
          name: 'Player Two',
          phone: '11777777777',
        })
        .expect(201);

      categoryPlayerId = body._id;
    });

    it('validates payload when creating a category', async () => {
      const { body } = await request(httpServer)
        .post('/api/v1/categories')
        .send({ category: 'invalid', description: '', events: [] })
        .expect(400);

      expect(Array.isArray(body.error.message)).toBe(true);
    });

    it('creates a category', async () => {
      const { body } = await request(httpServer)
        .post('/api/v1/categories')
        .send(categoryPayload)
        .expect(201);

      expect(body).toMatchObject({ category: categoryPayload.category, description: categoryPayload.description });
      expect(body.events).toHaveLength(1);
    });

    it('lists all categories', async () => {
      const { body } = await request(httpServer)
        .get('/api/v1/categories')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it('fetches a category by its code', async () => {
      const { body } = await request(httpServer)
        .get(`/api/v1/categories/${categoryPayload.category}`)
        .expect(200);

      expect(body.category).toBe(categoryPayload.category);
    });

    it('assigns a player to the category', async () => {
      await request(httpServer)
        .post(`/api/v1/categories/${categoryPayload.category}/players/${categoryPlayerId}`)
        .expect(201);
    });

    it('prevents duplicated player assignments', async () => {
      const { body } = await request(httpServer)
        .post(`/api/v1/categories/${categoryPayload.category}/players/${categoryPlayerId}`)
        .expect(400);

      expect(body.error.message).toContain('already assigned');
    });

    it('returns the category with assigned players populated', async () => {
      const { body } = await request(httpServer)
        .get('/api/v1/categories')
        .expect(200);

      const category = body.find((item) => item.category === categoryPayload.category);
      expect(category.players).toHaveLength(1);
      expect(category.players[0]._id).toBe(categoryPlayerId);
    });
  });
});
