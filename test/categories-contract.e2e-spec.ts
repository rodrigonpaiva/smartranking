import { HttpServer, INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { tenancyContext } from '../src/tenancy/tenancy.context';
import { Club } from '../src/clubs/interfaces/club.interface';
import { Category } from '../src/categories/interfaces/category.interface';
import { Player } from '../src/players/interfaces/players.interface';
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

describe('Categories contract e2e', () => {
  let app: INestApplication;
  let httpServer: HttpServer;
  let mongoServer: MongoMemoryServer;
  let clubModel: Model<Club>;
  let categoryModel: Model<Category>;
  let playerModel: Model<Player>;
  let tenantId: string;
  let clubId: string;
  let playerId: string;
  let memoryUnavailable = false;

  type CategoryDTO = {
    _id: string;
    category: string;
    clubId: string;
  };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value));

  const isCategoryDTO = (value: unknown): value is CategoryDTO => {
    if (!isRecord(value)) return false;
    return (
      typeof value._id === 'string' &&
      typeof value.category === 'string' &&
      typeof value.clubId === 'string'
    );
  };

  const isCategoryDTOArray = (value: unknown): value is CategoryDTO[] =>
    Array.isArray(value) && value.every(isCategoryDTO);

  beforeAll(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
    } catch (error) {
      memoryUnavailable = true;
      console.warn('Skipping categories contract e2e:', error);
      return;
    }
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.MONGODB_DB_NAME = 'smartranking_categories_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-please-change-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';

    const e2eApp = await createE2EApp();
    app = e2eApp.app;
    httpServer = e2eApp.httpServer as HttpServer;

    clubModel = app.get(getModelToken('Club'));
    categoryModel = app.get(getModelToken('Category'));
    playerModel = app.get(getModelToken('Player'));

    const clubObjectId = new Types.ObjectId();
    tenantId = clubObjectId.toHexString();
    clubId = tenantId;

    await tenancyContext.run(
      {
        tenant: tenantId,
        allowMissingTenant: false,
        disableTenancy: false,
      },
      async () => {
        await clubModel.create({
          _id: clubObjectId,
          tenant: tenantId,
          name: 'Categories Contract Club',
          slug: 'categories-contract-club',
          city: 'Lisbon',
          state: 'PT',
        } as unknown as Parameters<typeof clubModel.create>[0]);

        const playerModelUnsafe = playerModel as unknown as {
          create: (doc: unknown) => Promise<{ _id: unknown }>;
        };
        const player = await playerModelUnsafe.create({
          tenant: tenantId,
          name: 'Contract Player',
          email: 'contract.player@example.com',
          phone: '11999999999',
          clubId: clubObjectId,
        });
        playerId = String(player._id);

        const categoryModelUnsafe = categoryModel as unknown as {
          create: (doc: unknown) => Promise<unknown>;
        };
        await categoryModelUnsafe.create({
          tenant: tenantId,
          category: 'PADEL_MIXED',
          description: 'Padel Mixed',
          clubId: clubObjectId,
          players: [player._id],
        });
      },
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('GET /api/v1/categories returns a raw array', async () => {
    if (memoryUnavailable) {
      return;
    }
    const response = await e2e(httpServer, 'categories-contract')
      .get('/api/v1/categories')
      .set({
        'x-test-user': 'categories-admin',
        'x-test-role': 'system_admin',
        'x-tenant-id': tenantId,
      })
      .expect(200);

    const body: unknown = response.body;
    expect(isCategoryDTOArray(body)).toBe(true);
    if (!isCategoryDTOArray(body)) {
      throw new Error('Expected categories array payload');
    }
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]._id).toBeDefined();
    expect(body[0].category).toBeDefined();
    expect(body[0].clubId).toBeDefined();
  });

  it('GET /api/v1/categories/my returns a raw array', async () => {
    if (memoryUnavailable) {
      return;
    }
    const response = await e2e(httpServer, 'categories-contract')
      .get('/api/v1/categories/my')
      .set({
        'x-test-user': 'categories-player',
        'x-test-role': 'player',
        'x-test-club': clubId,
        'x-test-player': playerId,
        'x-tenant-id': tenantId,
      })
      .expect(200);

    const body: unknown = response.body;
    expect(isCategoryDTOArray(body)).toBe(true);
    if (!isCategoryDTOArray(body)) {
      throw new Error('Expected categories array payload');
    }
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]._id).toBeDefined();
    expect(body[0].category).toBeDefined();
    expect(body[0].clubId).toBeDefined();
  });
});
