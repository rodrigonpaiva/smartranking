import { HttpServer, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { ensureArray, ensureRecord, ensureString } from './utils/assertions';

type AppModuleImport = typeof import('../src/app.module');

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

describe('Tenancy e2e', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let httpServer: HttpServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.MONGODB_DB_NAME = 'smartranking-tenancy';
    process.env.BETTER_AUTH_SECRET = 'test-secret-please-change-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';

    const appModule = (await import('../src/app.module')) as AppModuleImport;
    const moduleRef = await Test.createTestingModule({
      imports: [appModule.AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    httpServer = app.getHttpServer() as HttpServer;
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

    const clubAResponse = await request(httpServer)
      .post('/api/v1/clubs')
      .set('x-tenant-id', tenantA)
      .send({ name: 'Club A', slug: 'club-a' })
      .expect(201);
    const clubABody = ensureRecord(clubAResponse.body, 'club A response');
    const clubAId = ensureString(clubABody._id, 'club A id');

    const clubBResponse = await request(httpServer)
      .post('/api/v1/clubs')
      .set('x-tenant-id', tenantB)
      .send({ name: 'Club B', slug: 'club-b' })
      .expect(201);
    const clubBBody = ensureRecord(clubBResponse.body, 'club B response');
    const clubBId = ensureString(clubBBody._id, 'club B id');

    await request(httpServer)
      .post('/api/v1/players')
      .set('x-tenant-id', tenantA)
      .send({
        email: 'a@example.com',
        name: 'Rider A',
        phone: '111',
        clubId: clubAId,
      })
      .expect(201);

    await request(httpServer)
      .post('/api/v1/categories')
      .set('x-tenant-id', tenantA)
      .send({
        category: 'A',
        description: 'Category A',
        events: [{ name: 'Win', operation: '+', value: 10 }],
        clubId: clubAId,
      })
      .expect(201);

    const clubsTenantBResponse = await request(httpServer)
      .get('/api/v1/clubs')
      .set('x-tenant-id', tenantB)
      .expect(200);
    const clubsTenantB = ensureArray(
      clubsTenantBResponse.body,
      'clubs tenant B',
    ).map((item, index) => ensureRecord(item, `club ${index}`));
    expect(clubsTenantB).toHaveLength(1);
    expect(ensureString(clubsTenantB[0]._id, 'club id')).toBe(clubBId);

    const playersTenantBResponse = await request(httpServer)
      .get('/api/v1/players')
      .set('x-tenant-id', tenantB)
      .expect(200);
    const playersTenantB = ensureArray(
      playersTenantBResponse.body,
      'players tenant B',
    );
    expect(playersTenantB).toHaveLength(0);

    const categoriesTenantBResponse = await request(httpServer)
      .get('/api/v1/categories')
      .set('x-tenant-id', tenantB)
      .expect(200);
    const categoriesTenantB = ensureArray(
      categoriesTenantBResponse.body,
      'categories tenant B',
    );
    expect(categoriesTenantB).toHaveLength(0);
  });

  it('rejects using a club from another tenant', async () => {
    const tenantA = 'club-a';
    const tenantB = 'club-b';

    const clubAResponse = await request(httpServer)
      .post('/api/v1/clubs')
      .set('x-tenant-id', tenantA)
      .send({ name: 'Club A2', slug: 'club-a2' })
      .expect(201);
    const clubABody = ensureRecord(clubAResponse.body, 'club response');
    const clubAId = ensureString(clubABody._id, 'club id');

    await request(httpServer)
      .post('/api/v1/players')
      .set('x-tenant-id', tenantB)
      .send({
        email: 'b@example.com',
        name: 'Rider B',
        phone: '222',
        clubId: clubAId,
      })
      .expect(404);
  });
});
