import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module';
import { MatchesService } from '../src/matches/matches.service';
import { tenancyContext } from '../src/tenancy/tenancy.context';
import { Club } from '../src/clubs/interfaces/club.interface';
import { Player } from '../src/players/interfaces/players.interface';
import { Category } from '../src/categories/interfaces/category.interface';

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
  let clubId: string;
  let categoryAId: string;
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

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    matchesService = app.get(MatchesService);
    clubModel = app.get(getModelToken('Club'));
    playerModel = app.get(getModelToken('Player'));
    categoryModel = app.get(getModelToken('Category'));

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

    await matchesService.createMatch({
      clubId,
      categoryId,
      format: 'SINGLES',
      bestOf: 3,
      decidingSetType: 'STANDARD',
      teams: [{ players: [playerA] }, { players: [playerB] }],
      sets,
      playedAt,
    });
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

    await matchesService.createMatch({
      clubId,
      categoryId,
      format: 'DOUBLES',
      bestOf: 3,
      decidingSetType: 'STANDARD',
      teams: [{ players: teamA }, { players: teamB }],
      sets,
      playedAt,
    });
  };

  const seedData = async () => {
    await runAsTenant(async () => {
      const club = await clubModel.create({
        name: 'Integration Padel House',
        slug: 'integration-padel-house',
        city: 'Lisbon',
        state: 'PT',
      });
      clubId = club._id.toString();

      const categoryA = await categoryModel.create({
        category: 'A',
        description: 'Advanced',
        clubId,
        players: [],
      });
      const categoryB = await categoryModel.create({
        category: 'B',
        description: 'Intermediate',
        clubId,
        players: [],
      });
      categoryAId = categoryA._id.toString();

      const playerDocs = await playerModel.create(
        Array.from({ length: 8 }).map((_, index) => ({
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
      matchesService.getRankingByCategory(categoryAId),
    );

    expect(ranking).toHaveLength(6);
    expect(ranking[0].name).toBe('Player 1');
    expect(ranking[0].rating).toBeGreaterThan(ranking[1].rating);
    expect(ranking[0].wins).toBeGreaterThan(0);
    expect(ranking[3].rating).toBeLessThan(ranking[2].rating);
    expect(ranking.map((item) => item.name)).toEqual([
      'Player 1',
      'Player 2',
      'Player 4',
      'Player 5',
      'Player 6',
      'Player 3',
    ]);
  });
});
