import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

jest.mock('better-auth', () => ({
  betterAuth: (options: Record<string, unknown>) => ({
    options,
    handler: (_req: unknown, res: { status: (code: number) => { end: () => void } }) => {
      res.status(200).end();
    },
  }),
}));

jest.mock('better-auth/adapters/mongodb', () => ({
  mongodbAdapter: () => ({}),
}));

describe('Tenancy e2e', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.MONGODB_DB_NAME = 'smartranking-tenancy';
    process.env.BETTER_AUTH_SECRET = 'test-secret-please-change-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';

    const { AppModule } = require('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('isolates clubs, players, and categories by tenant', async () => {
    const tenantA = 'club-a';
    const tenantB = 'club-b';

    const clubA = await request(app.getHttpServer())
      .post('/api/v1/clubs')
      .set('x-tenant-id', tenantA)
      .send({ name: 'Club A', slug: 'club-a' })
      .expect(201);

    const clubB = await request(app.getHttpServer())
      .post('/api/v1/clubs')
      .set('x-tenant-id', tenantB)
      .send({ name: 'Club B', slug: 'club-b' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/players')
      .set('x-tenant-id', tenantA)
      .send({
        email: 'a@example.com',
        name: 'Rider A',
        phone: '111',
        clubId: clubA.body._id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('x-tenant-id', tenantA)
      .send({
        category: 'A',
        description: 'Category A',
        events: [{ name: 'Win', operation: '+', value: 10 }],
        clubId: clubA.body._id,
      })
      .expect(201);

    const clubsTenantB = await request(app.getHttpServer())
      .get('/api/v1/clubs')
      .set('x-tenant-id', tenantB)
      .expect(200);
    expect(clubsTenantB.body).toHaveLength(1);
    expect(clubsTenantB.body[0]._id).toBe(clubB.body._id);

    const playersTenantB = await request(app.getHttpServer())
      .get('/api/v1/players')
      .set('x-tenant-id', tenantB)
      .expect(200);
    expect(playersTenantB.body).toHaveLength(0);

    const categoriesTenantB = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('x-tenant-id', tenantB)
      .expect(200);
    expect(categoriesTenantB.body).toHaveLength(0);
  });

  it('rejects using a club from another tenant', async () => {
    const tenantA = 'club-a';
    const tenantB = 'club-b';

    const clubA = await request(app.getHttpServer())
      .post('/api/v1/clubs')
      .set('x-tenant-id', tenantA)
      .send({ name: 'Club A2', slug: 'club-a2' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/players')
      .set('x-tenant-id', tenantB)
      .send({
        email: 'b@example.com',
        name: 'Rider B',
        phone: '222',
        clubId: clubA.body._id,
      })
      .expect(404);
  });
});
