import { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { MatchesService } from '../src/matches/matches.service';
import { tenancyContext } from '../src/tenancy/tenancy.context';
import { Club } from '../src/clubs/interfaces/club.interface';
import { Player } from '../src/players/interfaces/players.interface';
import { Category } from '../src/categories/interfaces/category.interface';
import { Match } from '../src/matches/interfaces/match.interface';
import { Roles } from '../src/auth/roles';
import type { AccessContext } from '../src/auth/access-context.types';
import { createE2EApp } from './utils/create-e2e-app';

const TENANT = 'seed-tenant';

const runAsTenant = async <T>(fn: () => Promise<T>) =>
  tenancyContext.run(
    {
      tenant: TENANT,
      allowMissingTenant: false,
      disableTenancy: false,
    },
    fn,
  );

describe('Ranking integration seeds', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let mongo: MongoMemoryServer;
  let matchesService: MatchesService;
  let clubModel: Model<Club>;
  let playerModel: Model<Player>;
  let categoryModel: Model<Category>;
  let matchModel: Model<Match>;
  let clubId: string;
  let categoryAId: string;
  const otherClubPlayerName = 'Other Club Player';
  let memoryUnavailable = false;

  beforeAll(async () => {
    try {
      mongo = await MongoMemoryServer.create();
    } catch (error) {
      memoryUnavailable = true;
      console.warn('Skipping ranking integration seeds:', error);
      return;
    }
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB_NAME = 'smartranking-integration';
    process.env.BETTER_AUTH_SECRET = 'integration-secret-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';

    const e2eApp = await createE2EApp();
    moduleFixture = e2eApp.moduleRef;
    app = e2eApp.app;

    matchesService = app.get(MatchesService);
    clubModel = app.get(getModelToken('Club'));
    playerModel = app.get(getModelToken('Player'));
    categoryModel = app.get(getModelToken('Category'));
    matchModel = app.get(getModelToken('Match'));

    await seedData();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongo) {
      await mongo.stop();
    }
  });

  const createSinglesMatch = async (
    categoryId: string,
    playerA: string,
    playerB: string,
    playedAt: string,
    winnerTeamIndex = 0,
  ) => {
    const sets = [
      {
        games: [
          { teamIndex: 0, score: winnerTeamIndex === 0 ? 6 : 3 },
          { teamIndex: 1, score: winnerTeamIndex === 0 ? 3 : 6 },
        ],
      },
      {
        games: [
          { teamIndex: 0, score: winnerTeamIndex === 0 ? 6 : 4 },
          { teamIndex: 1, score: winnerTeamIndex === 0 ? 4 : 6 },
        ],
      },
    ];

    const context: AccessContext = {
      userId: 'e2e-user',
      role: Roles.SYSTEM_ADMIN,
      tenantId: TENANT,
      clubId,
    };

    await matchesService.createMatch(
      {
        tenant: TENANT,
        clubId,
        categoryId,
        format: 'SINGLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        teams: [{ players: [playerA] }, { players: [playerB] }],
        sets,
        playedAt,
      } as unknown as Parameters<typeof matchesService.createMatch>[0],
      context,
    );
  };

  const createDoublesMatch = async (
    categoryId: string,
    teamA: string[],
    teamB: string[],
    playedAt: string,
    winnerTeamIndex = 0,
  ) => {
    const sets = [
      {
        games: [
          { teamIndex: 0, score: winnerTeamIndex === 0 ? 6 : 2 },
          { teamIndex: 1, score: winnerTeamIndex === 0 ? 2 : 6 },
        ],
      },
      {
        games: [
          { teamIndex: 0, score: winnerTeamIndex === 0 ? 6 : 3 },
          { teamIndex: 1, score: winnerTeamIndex === 0 ? 3 : 6 },
        ],
      },
    ];

    const context: AccessContext = {
      userId: 'e2e-user',
      role: Roles.SYSTEM_ADMIN,
      tenantId: TENANT,
      clubId,
    };

    await matchesService.createMatch(
      {
        tenant: TENANT,
        clubId,
        categoryId,
        format: 'DOUBLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        teams: [{ players: teamA }, { players: teamB }],
        sets,
        playedAt,
      } as unknown as Parameters<typeof matchesService.createMatch>[0],
      context,
    );
  };

  const seedData = async () => {
    await runAsTenant(async () => {
      const club = await clubModel.create({
        tenant: TENANT,
        name: 'Integration Padel House',
        slug: 'integration-padel-house',
        city: 'Lisbon',
        state: 'PT',
      });
      clubId = club._id.toString();

      const categoryA = await categoryModel.create({
        tenant: TENANT,
        category: 'A',
        description: 'Advanced',
        clubId,
        players: [],
      });
      const categoryB = await categoryModel.create({
        tenant: TENANT,
        category: 'B',
        description: 'Intermediate',
        clubId,
        players: [],
      });
      categoryAId = categoryA._id.toString();

      const playerDocs = await playerModel.create(
        Array.from({ length: 8 }).map((_, index) => ({
          tenant: TENANT,
          name: `Player ${index + 1}`,
          email: `player${index + 1}@example.com`,
          phone: `1190000000${index + 1}`,
          clubId,
          ranking: 1500,
        })),
      );

      const categoryAPlayers = playerDocs
        .slice(0, 6)
        .map((player) => player._id);
      const categoryBPlayers = playerDocs.slice(4).map((player) => player._id);

      await categoryModel.updateOne(
        { _id: categoryA._id },
        { $set: { players: categoryAPlayers } },
      );
      await categoryModel.updateOne(
        { _id: categoryB._id },
        { $set: { players: categoryBPlayers } },
      );

      const ids = playerDocs.map((player) => player._id.toString());

      await createSinglesMatch(
        categoryAId,
        ids[0],
        ids[1],
        '2025-01-01T10:00:00Z',
        0,
      );
      await createSinglesMatch(
        categoryAId,
        ids[2],
        ids[3],
        '2025-01-02T10:00:00Z',
        1,
      );
      await createDoublesMatch(
        categoryAId,
        [ids[0], ids[2]],
        [ids[1], ids[3]],
        '2025-01-03T10:00:00Z',
        0,
      );
      await createSinglesMatch(
        categoryAId,
        ids[4],
        ids[5],
        '2025-01-04T10:00:00Z',
        0,
      );
      await createSinglesMatch(
        categoryAId,
        ids[0],
        ids[3],
        '2025-01-05T10:00:00Z',
        1,
      );
      await createSinglesMatch(
        categoryAId,
        ids[1],
        ids[2],
        '2025-01-06T10:00:00Z',
        0,
      );
      await createDoublesMatch(
        categoryAId,
        [ids[0], ids[1]],
        [ids[4], ids[5]],
        '2025-01-07T10:00:00Z',
        0,
      );

      const categoryBId = categoryB._id.toString();
      await createSinglesMatch(
        categoryBId,
        ids[6],
        ids[7],
        '2025-01-08T10:00:00Z',
        0,
      );
      await createSinglesMatch(
        categoryBId,
        ids[4],
        ids[6],
        '2025-01-09T10:00:00Z',
        1,
      );
      await createDoublesMatch(
        categoryBId,
        [ids[6], ids[7]],
        [ids[4], ids[5]],
        '2025-01-10T10:00:00Z',
        0,
      );

      const otherClub = await clubModel.create({
        tenant: TENANT,
        name: 'Integration Second Club',
        slug: 'integration-second-club',
        city: 'Porto',
        state: 'PT',
      });
      const otherPlayer = await playerModel.create({
        tenant: TENANT,
        name: otherClubPlayerName,
        email: 'other.club.player@example.com',
        phone: '21900000001',
        clubId: otherClub._id,
        ranking: 1500,
      });
      const matchModelUnsafe = matchModel as unknown as {
        create: (doc: unknown) => Promise<unknown>;
      };
      await matchModelUnsafe.create({
        tenant: TENANT,
        categoryId: categoryAId,
        clubId: otherClub._id,
        format: 'SINGLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        teams: [{ players: [otherPlayer._id] }, { players: [ids[0]] }],
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
        participants: [
          { playerId: otherPlayer._id, result: 'WIN' },
          { playerId: ids[0], result: 'LOSS' },
        ],
        playedAt: new Date('2025-01-11T10:00:00Z'),
      });
    });
  };

  it('rebuilds rankings deterministically', async () => {
    if (memoryUnavailable) {
      console.warn(
        'Ranking integration skipped: MongoMemoryServer unavailable',
      );
      return;
    }

    const ranking = await runAsTenant(() =>
      matchesService.getRankingByCategory(
        categoryAId,
        { page: 1, limit: 20 },
        { userId: 'seed-admin', role: Roles.SYSTEM_ADMIN },
      ),
    );

    expect(ranking.total).toBe(6);
    expect(ranking.items).toHaveLength(6);
    expect(ranking.items[0].name).toBe('Player 1');
    // Current scoring rules: WIN=10, DRAW=5, LOSS=0.
    expect(ranking.items[0].points).toBe(30);
    expect(ranking.items[0].rating).toBe(30);
    expect(ranking.items[0].wins).toBeGreaterThan(0);
    expect(ranking.items[ranking.items.length - 1].name).toBe('Player 6');
    expect(ranking.items[ranking.items.length - 1].points).toBe(0);
    for (let index = 1; index < ranking.items.length; index += 1) {
      expect(ranking.items[index - 1].points).toBeGreaterThanOrEqual(
        ranking.items[index].points,
      );
    }
    expect(ranking.items.map((item) => item.name)).not.toContain(
      otherClubPlayerName,
    );
  });
});
