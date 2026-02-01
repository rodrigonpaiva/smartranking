import { HttpServer, INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { ensureArray, ensureRecord, ensureString } from './utils/assertions';
import { createE2EApp, e2e } from './utils/create-e2e-app';

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

  const adminSession = (tenant: string) => ({
    'x-test-user': `tenant-admin-${tenant}`,
    'x-test-role': 'system_admin',
    'x-tenant-id': tenant,
  });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.MONGODB_DB_NAME = 'smartranking-tenancy';
    process.env.BETTER_AUTH_SECRET = 'test-secret-please-change-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';

    const e2eApp = await createE2EApp();
    app = e2eApp.app;
    httpServer = e2eApp.httpServer as HttpServer;
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

    const clubAResponse = await e2e(httpServer, 'tenancy')
      .post('/api/v1/clubs')
      .set(adminSession(tenantA))
      .send({ name: 'Club A', slug: 'club-a' })
      .expect(201);
    const clubABody = ensureRecord(clubAResponse.body, 'club A response');
    const clubAId = ensureString(clubABody._id, 'club A id');

    const clubBResponse = await e2e(httpServer, 'tenancy')
      .post('/api/v1/clubs')
      .set(adminSession(tenantB))
      .send({ name: 'Club B', slug: 'club-b' })
      .expect(201);
    const clubBBody = ensureRecord(clubBResponse.body, 'club B response');
    const clubBId = ensureString(clubBBody._id, 'club B id');

    await e2e(httpServer, 'tenancy')
      .post('/api/v1/players')
      .set(adminSession(clubAId))
      .send({
        email: 'a@example.com',
        name: 'Rider A',
        phone: '1111111111',
        clubId: clubAId,
      })
      .expect(201);

    await e2e(httpServer, 'tenancy')
      .post('/api/v1/categories')
      .set(adminSession(clubAId))
      .send({
        category: 'A',
        description: 'Category A',
        events: [{ name: 'Win', operation: '+', value: 10 }],
        clubId: clubAId,
      })
      .expect(201);

    const clubsTenantBResponse = await e2e(httpServer, 'tenancy')
      .get('/api/v1/clubs')
      .set(adminSession(clubBId))
      .expect(200);
    const clubsTenantBPage = ensureRecord(
      clubsTenantBResponse.body,
      'clubs tenant B page',
    );
    const clubsTenantB = ensureArray(
      clubsTenantBPage.items,
      'clubs tenant B',
    ).map((item, index) => ensureRecord(item, `club ${index}`));
    expect(clubsTenantB).toHaveLength(1);
    expect(ensureString(clubsTenantB[0]._id, 'club id')).toBe(clubBId);

    const playersTenantBResponse = await e2e(httpServer, 'tenancy')
      .get('/api/v1/players')
      .set(adminSession(clubBId))
      .expect(200);
    const playersTenantBPage = ensureRecord(
      playersTenantBResponse.body,
      'players tenant B page',
    );
    const playersTenantB = ensureArray(
      playersTenantBPage.items,
      'players tenant B',
    );
    expect(playersTenantB).toHaveLength(0);

    const categoriesTenantBResponse = await e2e(httpServer, 'tenancy')
      .get('/api/v1/categories')
      .set(adminSession(clubBId))
      .expect(200);

    // CategoriesController returns a raw array (not a PaginatedResult).
    const categoriesTenantB = ensureArray(
      categoriesTenantBResponse.body,
      'categories tenant B',
    );
    expect(categoriesTenantB).toHaveLength(0);
  });

  it('rejects using a club from another tenant', async () => {
    const tenantA = 'club-a';
    const tenantB = 'club-b';

    const clubAResponse = await e2e(httpServer, 'tenancy')
      .post('/api/v1/clubs')
      .set(adminSession(tenantA))
      .send({ name: 'Club A2', slug: 'club-a2' })
      .expect(201);
    const clubABody = ensureRecord(clubAResponse.body, 'club response');
    const clubAId = ensureString(clubABody._id, 'club id');

    await e2e(httpServer, 'tenancy')
      .post('/api/v1/players')
      .set(adminSession(tenantB))
      .send({
        email: 'b@example.com',
        name: 'Rider B',
        phone: '2222222222',
        clubId: clubAId,
      })
      .expect(404);
  });

  it('blocks cross-tenant player access by identifier', async () => {
    const tenantA = 'iso-a';
    const tenantB = 'iso-b';

    const clubAResponse = await e2e(httpServer, 'tenancy')
      .post('/api/v1/clubs')
      .set(adminSession(tenantA))
      .send({ name: 'Iso Club A', slug: 'iso-club-a' })
      .expect(201);
    const clubAId = ensureString(
      ensureRecord(clubAResponse.body, 'club a iso')._id,
      'club a id',
    );

    const playerResponse = await e2e(httpServer, 'tenancy')
      .post('/api/v1/players')
      .set(adminSession(clubAId))
      .send({
        email: 'isolated@example.com',
        name: 'Isolated Player',
        phone: '11900011111',
        clubId: clubAId,
      })
      .expect(201);
    const playerId = ensureString(
      ensureRecord(playerResponse.body, 'iso player')._id,
      'player id',
    );

    await e2e(httpServer, 'tenancy')
      .get(`/api/v1/players/${playerId}`)
      .set(adminSession(tenantB))
      .expect(404);

    // UpdatePlayerDto requires both name + phone, otherwise ValidationPipe returns 400.
    await e2e(httpServer, 'tenancy')
      .put(`/api/v1/players/${playerId}`)
      .set(adminSession(tenantB))
      .send({ name: 'Hacker', phone: '11999999999' })
      .expect(404);

    await e2e(httpServer, 'tenancy')
      .delete(`/api/v1/players/${playerId}`)
      .set(adminSession(tenantB))
      .expect(404);

    const allowed = await e2e(httpServer, 'tenancy')
      .get(`/api/v1/players/${playerId}`)
      .set(adminSession(clubAId))
      .expect(200);
    expect(ensureRecord(allowed.body, 'player read').name).toBe(
      'Isolated Player',
    );
  });

  it('prevents ranking aggregate leaks', async () => {
    const tenantA = 'agg-a';
    const tenantB = 'agg-b';

    const clubResponse = await e2e(httpServer, 'tenancy')
      .post('/api/v1/clubs')
      .set(adminSession(tenantA))
      .send({ name: 'Agg Club', slug: 'agg-club' })
      .expect(201);
    const clubId = ensureString(
      ensureRecord(clubResponse.body, 'agg club')._id,
      'agg club id',
    );

    const playerA = await e2e(httpServer, 'tenancy')
      .post('/api/v1/players')
      .set(adminSession(clubId))
      .send({
        email: 'agg-a@example.com',
        name: 'Agg Player A',
        phone: '11911111111',
        clubId,
      })
      .expect(201);
    const playerAId = ensureString(
      ensureRecord(playerA.body, 'agg player a')._id,
      'agg player a id',
    );

    const playerB = await e2e(httpServer, 'tenancy')
      .post('/api/v1/players')
      .set(adminSession(clubId))
      .send({
        email: 'agg-b@example.com',
        name: 'Agg Player B',
        phone: '11922222222',
        clubId,
      })
      .expect(201);
    const playerBId = ensureString(
      ensureRecord(playerB.body, 'agg player b')._id,
      'agg player b id',
    );

    const categoryResponse = await e2e(httpServer, 'tenancy')
      .post('/api/v1/categories')
      .set(adminSession(clubId))
      .send({
        category: 'AGG',
        description: 'Aggregate',
        clubId,
        events: [{ name: 'Win', operation: '+', value: 10 }],
      })
      .expect(201);
    const category = ensureRecord(categoryResponse.body, 'agg category');
    const categoryId = ensureString(category._id, 'agg category id');

    await e2e(httpServer, 'tenancy')
      .post(`/api/v1/categories/AGG/players/${playerAId}`)
      .set(adminSession(clubId))
      .expect(201);
    await e2e(httpServer, 'tenancy')
      .post(`/api/v1/categories/AGG/players/${playerBId}`)
      .set(adminSession(clubId))
      .expect(201);

    await e2e(httpServer, 'tenancy')
      .post('/api/v1/matches')
      .set(adminSession(clubId))
      .send({
        categoryId,
        clubId,
        format: 'SINGLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        teams: [{ players: [playerAId] }, { players: [playerBId] }],
        sets: [
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 4 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 3 },
            ],
          },
        ],
      })
      .expect(201);

    const rankingResponse = await e2e(httpServer, 'tenancy')
      .get(`/api/v1/matches/ranking/${categoryId}`)
      .set(adminSession(clubId))
      .expect(200);
    const rankingBody = ensureRecord(rankingResponse.body, 'ranking body');
    expect(Array.isArray(rankingBody.items)).toBe(true);

    await e2e(httpServer, 'tenancy')
      .get(`/api/v1/matches/ranking/${categoryId}`)
      .set(adminSession(tenantB))
      .expect(404);
  });
});
