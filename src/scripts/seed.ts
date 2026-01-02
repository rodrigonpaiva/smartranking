import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import pino from 'pino';
import { AppModule } from '../app.module';
import { tenancyContext } from '../tenancy/tenancy.context';
import { Club } from '../clubs/interfaces/club.interface';
import { Category } from '../categories/interfaces/category.interface';
import { Player } from '../players/interfaces/players.interface';
import { MatchesService } from '../matches/matches.service';
import { UserProfilesService } from '../users/users.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';
import { Match } from '../matches/interfaces/match.interface';
import { auth } from '../auth/auth';
import { StructuredLoggerService } from '../common/logger/logger.service';
import type { CreateMatchDto } from '../matches/dtos/create-match.dto';

interface SeedUserInput {
  email: string;
  password: string;
  name: string;
}

interface MatchTeamSeed {
  players: number[];
}

interface MatchScoreSeed {
  teamIndex: 0 | 1;
  score: number;
}

interface MatchSetSeed {
  games: MatchScoreSeed[];
  tiebreak?: MatchScoreSeed[];
}

interface SeedMatchPlan {
  category: string;
  format: 'SINGLES' | 'DOUBLES';
  bestOf: number;
  decidingSetType:
    | 'STANDARD'
    | 'ADVANTAGE'
    | 'SUPER_TIEBREAK_7'
    | 'SUPER_TIEBREAK_10';
  teams: MatchTeamSeed[];
  sets: MatchSetSeed[];
  playedAt: string;
}

interface SeedPlayerInput {
  name: string;
  email: string;
  phone: string;
}

interface ClubSeedPlan {
  slug: string;
  name: string;
  city: string;
  state: string;
  categories: Array<{ code: string; description: string }>;
  categoryAssignments: Record<string, number[]>;
  players: SeedPlayerInput[];
  matches: SeedMatchPlan[];
  manager: SeedUserInput;
}

interface SeededClubContext {
  plan: ClubSeedPlan;
  club: Club;
  players: Player[];
  categories: Record<string, Category>;
  tenantId: string;
}

interface SeededUser {
  id: string;
  email: string;
}

interface SeededAccounts {
  systemAdmin: SeededUser;
  clubManagers: Record<string, SeededUser>;
  featuredPlayer: SeededUser;
}

const DEFAULT_PASSWORDS = {
  admin: 'Admin123!',
  manager: 'Club123!',
  player: 'Player123!',
};

const PLAYER_ACCOUNT: SeedUserInput = {
  email: 'player@demo.smartranking',
  password: DEFAULT_PASSWORDS.player,
  name: 'Demo Player',
};

const CLUB_SEEDS: ClubSeedPlan[] = [
  {
    slug: 'demo-tennis-club',
    name: 'Demo Tennis & Padel Club',
    city: 'São Paulo',
    state: 'SP',
    categories: [
      { code: 'MENS_OPEN', description: 'Mens open singles ladder' },
      { code: 'MIXED_SOCIAL', description: 'Mixed social doubles ladder' },
      { code: 'PADEL_PREMIER', description: 'Padel premier doubles ladder' },
    ],
    categoryAssignments: {
      MENS_OPEN: [0, 1, 2, 3, 4, 5, 6, 7],
      MIXED_SOCIAL: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      PADEL_PREMIER: [4, 5, 6, 7, 8, 9, 10, 11],
    },
    players: [
      {
        name: 'Alex Costa',
        email: 'alex.costa@demo.smartranking',
        phone: '11970000001',
      },
      {
        name: 'Bianca Souza',
        email: 'bianca.souza@demo.smartranking',
        phone: '11970000002',
      },
      {
        name: 'Caio Lima',
        email: 'caio.lima@demo.smartranking',
        phone: '11970000003',
      },
      {
        name: 'Daniela Faria',
        email: 'daniela.faria@demo.smartranking',
        phone: '11970000004',
      },
      {
        name: 'Eduardo Mendes',
        email: 'eduardo.mendes@demo.smartranking',
        phone: '11970000005',
      },
      {
        name: 'Fernanda Alves',
        email: 'fernanda.alves@demo.smartranking',
        phone: '11970000006',
      },
      {
        name: 'Gustavo Duarte',
        email: 'gustavo.duarte@demo.smartranking',
        phone: '11970000007',
      },
      {
        name: 'Helena Prado',
        email: 'helena.prado@demo.smartranking',
        phone: '11970000008',
      },
      {
        name: 'Igor Ramos',
        email: 'igor.ramos@demo.smartranking',
        phone: '11970000009',
      },
      {
        name: 'Juliana Teixeira',
        email: 'juliana.teixeira@demo.smartranking',
        phone: '11970000010',
      },
      {
        name: 'Lucas Nogueira',
        email: 'lucas.nogueira@demo.smartranking',
        phone: '11970000011',
      },
      {
        name: 'Mariana Barros',
        email: 'mariana.barros@demo.smartranking',
        phone: '11970000012',
      },
    ],
    matches: [
      {
        category: 'MENS_OPEN',
        format: 'SINGLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        playedAt: '2024-09-15T14:00:00Z',
        teams: [{ players: [0] }, { players: [1] }],
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
      },
      {
        category: 'MENS_OPEN',
        format: 'SINGLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        playedAt: '2024-09-22T16:00:00Z',
        teams: [{ players: [2] }, { players: [3] }],
        sets: [
          {
            games: [
              { teamIndex: 0, score: 4 },
              { teamIndex: 1, score: 6 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 3 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 4 },
              { teamIndex: 1, score: 6 },
            ],
          },
        ],
      },
      {
        category: 'MIXED_SOCIAL',
        format: 'DOUBLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        playedAt: '2024-10-05T18:30:00Z',
        teams: [{ players: [0, 3] }, { players: [1, 2] }],
        sets: [
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 2 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 4 },
            ],
          },
        ],
      },
    ],
    manager: {
      email: 'club.demo@demo.smartranking',
      password: DEFAULT_PASSWORDS.manager,
      name: 'Demo Club Manager',
    },
  },
  {
    slug: 'laguna-padel-club',
    name: 'Laguna Padel & Tennis',
    city: 'Rio de Janeiro',
    state: 'RJ',
    categories: [
      { code: 'PADEL_MIXED', description: 'Mixed padel ladder' },
      { code: 'WOMENS_OPEN', description: 'Women singles ladder' },
      { code: 'MENS_CLAY', description: 'Mens clay singles ladder' },
    ],
    categoryAssignments: {
      PADEL_MIXED: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      WOMENS_OPEN: [5, 7, 8, 9, 11],
      MENS_CLAY: [0, 2, 3, 4, 6],
    },
    players: [
      {
        name: 'Nicolas Araujo',
        email: 'nicolas.araujo@laguna.smartranking',
        phone: '21980000001',
      },
      {
        name: 'Olivia Martins',
        email: 'olivia.martins@laguna.smartranking',
        phone: '21980000002',
      },
      {
        name: 'Pedro Queiroz',
        email: 'pedro.queiroz@laguna.smartranking',
        phone: '21980000003',
      },
      {
        name: 'Queila Andrade',
        email: 'queila.andrade@laguna.smartranking',
        phone: '21980000004',
      },
      {
        name: 'Rafael Moreira',
        email: 'rafael.moreira@laguna.smartranking',
        phone: '21980000005',
      },
      {
        name: 'Sofia Carvalho',
        email: 'sofia.carvalho@laguna.smartranking',
        phone: '21980000006',
      },
      {
        name: 'Tiago Paes',
        email: 'tiago.paes@laguna.smartranking',
        phone: '21980000007',
      },
      {
        name: 'Vitoria Lopes',
        email: 'vitoria.lopes@laguna.smartranking',
        phone: '21980000008',
      },
      {
        name: 'Wagner Reis',
        email: 'wagner.reis@laguna.smartranking',
        phone: '21980000009',
      },
      {
        name: 'Yasmin Duarte',
        email: 'yasmin.duarte@laguna.smartranking',
        phone: '21980000010',
      },
      {
        name: 'Zeca Prado',
        email: 'zeca.prado@laguna.smartranking',
        phone: '21980000011',
      },
      {
        name: 'Larissa Melo',
        email: 'larissa.melo@laguna.smartranking',
        phone: '21980000012',
      },
    ],
    matches: [
      {
        category: 'PADEL_MIXED',
        format: 'DOUBLES',
        bestOf: 3,
        decidingSetType: 'SUPER_TIEBREAK_10',
        playedAt: '2024-11-12T19:00:00Z',
        teams: [{ players: [0, 7] }, { players: [1, 8] }],
        sets: [
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 3 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 4 },
              { teamIndex: 1, score: 6 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 0 },
              { teamIndex: 1, score: 0 },
            ],
            tiebreak: [
              { teamIndex: 0, score: 8 },
              { teamIndex: 1, score: 10 },
            ],
          },
        ],
      },
      {
        category: 'WOMENS_OPEN',
        format: 'SINGLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        playedAt: '2024-11-20T15:30:00Z',
        teams: [{ players: [5] }, { players: [9] }],
        sets: [
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 1 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 4 },
            ],
          },
        ],
      },
      {
        category: 'MENS_CLAY',
        format: 'SINGLES',
        bestOf: 3,
        decidingSetType: 'STANDARD',
        playedAt: '2024-12-03T13:15:00Z',
        teams: [{ players: [2] }, { players: [4] }],
        sets: [
          {
            games: [
              { teamIndex: 0, score: 7 },
              { teamIndex: 1, score: 5 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 3 },
              { teamIndex: 1, score: 6 },
            ],
          },
          {
            games: [
              { teamIndex: 0, score: 6 },
              { teamIndex: 1, score: 2 },
            ],
          },
        ],
      },
    ],
    manager: {
      email: 'club.laguna@demo.smartranking',
      password: DEFAULT_PASSWORDS.manager,
      name: 'Laguna Club Manager',
    },
  },
];

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(StructuredLoggerService);
  const clubModel = app.get<Model<Club>>(getModelToken('Club'));
  const categoryModel = app.get<Model<Category>>(getModelToken('Category'));
  const playerModel = app.get<Model<Player>>(getModelToken('Player'));
  const matchModel = app.get<Model<Match>>(getModelToken('Match'));
  const matchesService = app.get(MatchesService);
  const profilesService = app.get(UserProfilesService);

  const accounts = await seedAuthUsers();
  const seededClubs: SeededClubContext[] = [];

  for (const plan of CLUB_SEEDS) {
    const tenantId = deterministicObjectId(plan.slug);
    await tenancyContext.run(
      {
        tenant: tenantId,
        allowMissingTenant: false,
        disableTenancy: false,
      },
      async () => {
        const club = await ensureClub(clubModel, plan, tenantId);
        const categories = await ensureCategories(categoryModel, plan, club);
        const players = await ensurePlayers(playerModel, plan, club);
        await assignPlayersToCategories(
          categoryModel,
          categories,
          plan,
          players,
        );
        await seedMatchesForPlan(
          matchesService,
          matchModel,
          plan,
          club,
          categories,
          players,
          accounts.systemAdmin.id,
          tenantId,
        );
        seededClubs.push({
          plan,
          club,
          players,
          categories,
          tenantId,
        });
      },
    );
  }

  await upsertProfiles(profilesService, seededClubs, accounts);
  logSummary(logger, seededClubs, accounts);
  await app.close();
}

async function ensureClub(
  clubModel: Model<Club>,
  plan: ClubSeedPlan,
  tenantId: string,
): Promise<Club> {
  const base = {
    name: plan.name,
    slug: plan.slug,
    city: plan.city,
    state: plan.state,
  };
  const setOnInsert = { _id: new Types.ObjectId(tenantId) };
  const club = await clubModel
    .findOneAndUpdate(
      { slug: plan.slug },
      { $set: base, $setOnInsert: setOnInsert },
      { upsert: true, new: true },
    )
    .exec();
  return club as Club;
}

async function ensureCategories(
  categoryModel: Model<Category>,
  plan: ClubSeedPlan,
  club: Club,
): Promise<Record<string, Category>> {
  const categories: Record<string, Category> = {};
  for (const definition of plan.categories) {
    let category = await categoryModel
      .findOne({ category: definition.code, clubId: club._id })
      .exec();
    if (!category) {
      category = await categoryModel.create({
        category: definition.code,
        description: definition.description,
        clubId: club._id,
        players: [],
      });
    } else if (category.description !== definition.description) {
      category.description = definition.description;
      await category.save();
    }
    categories[definition.code] = category as Category;
  }
  return categories;
}

async function ensurePlayers(
  playerModel: Model<Player>,
  plan: ClubSeedPlan,
  club: Club,
): Promise<Player[]> {
  const players: Player[] = [];
  for (const seed of plan.players) {
    const player = await playerModel
      .findOneAndUpdate(
        { email: seed.email, clubId: club._id },
        { $set: { ...seed, clubId: club._id } },
        { upsert: true, new: true },
      )
      .exec();
    players.push(player as Player);
  }
  return players;
}

async function assignPlayersToCategories(
  categoryModel: Model<Category>,
  categories: Record<string, Category>,
  plan: ClubSeedPlan,
  players: Player[],
): Promise<void> {
  for (const [code, category] of Object.entries(categories)) {
    const indexes =
      plan.categoryAssignments[code] ?? players.map((_, idx) => idx);
    const playerIds = indexes
      .map((index) => players[index]?._id)
      .filter(Boolean)
      .map((id) => toStringId(id, 'player'));
    await categoryModel
      .updateOne({ _id: category._id }, { $set: { players: playerIds } })
      .exec();
  }
}

async function seedMatchesForPlan(
  matchesService: MatchesService,
  matchModel: Model<Match>,
  plan: ClubSeedPlan,
  club: Club,
  categories: Record<string, Category>,
  players: Player[],
  adminUserId: string,
  tenantId: string,
): Promise<void> {
  const adminContext: AccessContext = {
    userId: adminUserId,
    role: Roles.SYSTEM_ADMIN,
    tenantId,
  };
  const clubId = toStringId(club._id, 'club');
  for (const matchSeed of plan.matches) {
    const category = categories[matchSeed.category];
    if (!category) {
      continue;
    }
    const categoryId = toStringId(category._id, 'category');
    const existing = await matchModel
      .findOne({
        clubId,
        categoryId,
        playedAt: new Date(matchSeed.playedAt),
      })
      .exec();
    if (existing) {
      continue;
    }
    const teams = matchSeed.teams.map((team) => ({
      players: team.players.map((playerIndex) =>
        toStringId(players[playerIndex]?._id, 'player'),
      ),
    }));
    const payload: CreateMatchDto = {
      categoryId,
      clubId,
      format: matchSeed.format,
      bestOf: matchSeed.bestOf,
      decidingSetType: matchSeed.decidingSetType,
      teams,
      sets: matchSeed.sets,
      playedAt: matchSeed.playedAt,
    };
    await matchesService.createMatch(payload, adminContext);
  }
}

function toStringId(value: unknown, label: string): string {
  if (!value) {
    throw new Error(`${label} identifier is missing`);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }
  const candidate = value as { toString?: () => string };
  if (candidate.toString) {
    const result = candidate.toString();
    if (result) {
      return result;
    }
  }
  throw new Error(`Unable to resolve ${label} identifier`);
}

function deterministicObjectId(seed: string): string {
  const hash = createHash('sha1').update(seed).digest('hex').substring(0, 24);
  return new Types.ObjectId(hash).toHexString();
}

async function seedAuthUsers(): Promise<SeededAccounts> {
  const systemAdmin = await ensureAuthUser({
    email: 'admin@demo.smartranking',
    password: DEFAULT_PASSWORDS.admin,
    name: 'Demo Admin',
  });
  const featuredPlayer = await ensureAuthUser(PLAYER_ACCOUNT);
  const clubManagers: Record<string, SeededUser> = {};

  for (const plan of CLUB_SEEDS) {
    clubManagers[plan.slug] = await ensureAuthUser(plan.manager);
  }

  return { systemAdmin, clubManagers, featuredPlayer };
}

async function ensureAuthUser(credentials: SeedUserInput): Promise<SeededUser> {
  try {
    const result = await auth.api?.signUpEmail({
      body: {
        email: credentials.email,
        password: credentials.password,
        name: credentials.name,
      },
    });
    if (result?.user?.id) {
      return { id: result.user.id, email: result.user.email };
    }
  } catch (error) {
    if (!isUserExistsError(error)) {
      throw error;
    }
  }
  const fallback = await auth.api?.signInEmail({
    body: { email: credentials.email, password: credentials.password },
  });
  if (fallback?.user?.id) {
    return { id: fallback.user.id, email: fallback.user.email };
  }
  const context = await auth.$context;
  const existing = await context.internalAdapter.findUserByEmail(
    credentials.email,
  );
  if (existing?.user?.id) {
    return { id: existing.user.id, email: existing.user.email } as SeededUser;
  }
  throw new Error(`Unable to provision auth user for ${credentials.email}`);
}

function isUserExistsError(error: unknown): boolean {
  if (!error) return false;
  const status = (error as { status?: string; statusCode?: number }).status;
  const statusCode = (error as { statusCode?: number }).statusCode;
  return status === 'UNPROCESSABLE_ENTITY' || statusCode === 422;
}

async function upsertProfiles(
  profilesService: UserProfilesService,
  seededClubs: SeededClubContext[],
  accounts: SeededAccounts,
): Promise<void> {
  const adminContext: AccessContext = {
    userId: accounts.systemAdmin.id,
    role: Roles.SYSTEM_ADMIN,
    tenantId: null,
  };
  await profilesService.upsertProfile(
    { userId: accounts.systemAdmin.id, role: Roles.SYSTEM_ADMIN },
    adminContext,
  );

  for (const seeded of seededClubs) {
    const manager = accounts.clubManagers[seeded.plan.slug];
    if (!manager) {
      continue;
    }
    await profilesService.upsertProfile(
      {
        userId: manager.id,
        role: Roles.CLUB,
        clubId: toStringId(seeded.club._id, 'club'),
      },
      adminContext,
    );
  }

  const primaryClub = seededClubs[0];
  if (primaryClub?.players[0]) {
    await profilesService.upsertProfile(
      {
        userId: accounts.featuredPlayer.id,
        role: Roles.PLAYER,
        clubId: toStringId(primaryClub.club._id, 'club'),
        playerId: toStringId(primaryClub.players[0]._id, 'player'),
      },
      adminContext,
    );
  }
}

function logSummary(
  logger: StructuredLoggerService,
  seededClubs: SeededClubContext[],
  accounts: SeededAccounts,
): void {
  logger.log('seed.summary', {
    tenants: seededClubs.map((seeded) => ({
      slug: seeded.plan.slug,
      tenantId: seeded.tenantId,
      clubId: toStringId(seeded.club._id, 'club'),
      players: seeded.players.length,
      categories: seeded.plan.categories.length,
    })),
    users: {
      systemAdmin: {
        email: accounts.systemAdmin.email,
        password: DEFAULT_PASSWORDS.admin,
      },
      clubManagers: seededClubs.map((seeded) => ({
        slug: seeded.plan.slug,
        email: accounts.clubManagers[seeded.plan.slug]?.email,
        password: seeded.plan.manager.password,
      })),
      featuredPlayer: {
        email: accounts.featuredPlayer.email,
        password: DEFAULT_PASSWORDS.player,
      },
    },
  });
}

bootstrap().catch((error) => {
  const fallbackLogger = pino({
    level: 'error',
    base: { source: 'seed-script' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  fallbackLogger.error({ err: error }, 'Seed script failed');
  process.exit(1);
});
