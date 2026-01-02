import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from '../categories/interfaces/category.interface';
import { Club } from '../clubs/interfaces/club.interface';
import { Player } from '../players/interfaces/players.interface';
import { TenancyService } from '../tenancy/tenancy.service';
import { CreateMatchDto } from './dtos/create-match.dto';
import { Match } from './interfaces/match.interface';
import type { AccessContext } from '../auth/access-context.types';
import { Roles } from '../auth/roles';
import { AuditService } from '../audit/audit.service';
import { AuditEvent } from '../audit/audit.events';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListMatchesQueryDto } from './dtos/list-matches.query';
import { ListMatchesByCategoryQueryDto } from './dtos/list-matches-by-category.query';
import { ListRankingQueryDto } from './dtos/list-ranking.query';
import type { RankingEntry } from './interfaces/ranking-entry.interface';
import { StructuredLoggerService } from '../common/logger/logger.service';
import { clampPagination } from '../common/pagination/pagination.util';

const ELO_INITIAL_RATING = 1500;
const ELO_K_SINGLES = 32;
const ELO_K_DOUBLES = 24;
const RESULT_TO_SCORE: Record<'WIN' | 'DRAW' | 'LOSS', number> = {
  WIN: 1,
  DRAW: 0.5,
  LOSS: 0,
};

type DecidingSetType =
  | 'STANDARD'
  | 'ADVANTAGE'
  | 'SUPER_TIEBREAK_7'
  | 'SUPER_TIEBREAK_10';

@Injectable()
export class MatchesService {
  constructor(
    @InjectModel('Match') private readonly matchModel: Model<Match>,
    @InjectModel('Category') private readonly categoryModel: Model<Category>,
    @InjectModel('Club') private readonly clubModel: Model<Club>,
    @InjectModel('Player') private readonly playerModel: Model<Player>,
    private readonly tenancyService: TenancyService,
    private readonly auditService: AuditService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async createMatch(
    dto: CreateMatchDto,
    context: AccessContext,
  ): Promise<Match> {
    this.ensureClubAccess(context, this.toId(dto.clubId));
    const club = await this.clubModel.findById(dto.clubId).exec();
    if (!club) {
      throw new NotFoundException(`Club with id ${dto.clubId} not found`);
    }

    const category = await this.categoryModel.findById(dto.categoryId).exec();
    if (!category) {
      throw new NotFoundException(
        `Category with id ${dto.categoryId} not found`,
      );
    }
    this.ensureCategoryAccess(category, context);
    if (this.toId(category.clubId) !== this.toId(dto.clubId)) {
      throw new BadRequestException('Category does not belong to club');
    }

    if (dto.bestOf % 2 === 0) {
      throw new BadRequestException('bestOf must be an odd number');
    }
    const decidingSetType = this.normalizeDecidingSetType(dto.decidingSetType);
    if (decidingSetType !== 'STANDARD' && dto.bestOf !== 3) {
      throw new BadRequestException('decidingSetType only applies to bestOf 3');
    }
    if (dto.teams.length !== 2) {
      throw new BadRequestException('Match must have exactly 2 teams');
    }
    const expectedTeamSize = dto.format === 'DOUBLES' ? 2 : 1;
    dto.teams.forEach((team) => {
      if (team.players.length !== expectedTeamSize) {
        throw new BadRequestException(
          `Each team must have ${expectedTeamSize} player(s)`,
        );
      }
    });

    const participantIds = dto.teams.flatMap((team) => team.players);
    const uniqueParticipantIds = new Set(participantIds);
    if (uniqueParticipantIds.size !== participantIds.length) {
      throw new BadRequestException('Duplicate players in teams');
    }

    const players = await this.playerModel
      .find({ _id: { $in: participantIds } })
      .exec();
    if (players.length !== participantIds.length) {
      throw new NotFoundException('One or more players not found');
    }
    const invalidClubPlayer = players.find(
      (player) => this.toId(player.clubId) !== this.toId(dto.clubId),
    );
    if (invalidClubPlayer) {
      throw new BadRequestException('Player does not belong to club');
    }
    const categoryPlayerIds = new Set(
      (category.players ?? []).map((player) => {
        const raw = (player as { _id?: unknown })._id ?? player;
        return this.toId(raw);
      }),
    );
    const invalidCategoryPlayer = participantIds.find(
      (playerId) => !categoryPlayerIds.has(this.toId(playerId)),
    );
    if (invalidCategoryPlayer) {
      throw new BadRequestException('Player is not in this category');
    }

    if (dto.sets.length > dto.bestOf) {
      throw new BadRequestException('Number of sets exceeds bestOf');
    }

    const teamWins = [0, 0];
    dto.sets.forEach((set, index) => {
      const isDecidingSet =
        dto.bestOf === 3 && dto.sets.length === 3 && index === 2;
      const useSuperTieBreak =
        isDecidingSet && decidingSetType.startsWith('SUPER_TIEBREAK');

      const scores = new Map<number, number>();
      set.games.forEach((game) => {
        if (game.teamIndex !== 0 && game.teamIndex !== 1) {
          throw new BadRequestException(
            `Set ${index + 1} has invalid team index`,
          );
        }
        scores.set(game.teamIndex, game.score);
      });
      const team0Score = scores.get(0);
      const team1Score = scores.get(1);
      if (team0Score === undefined || team1Score === undefined) {
        throw new BadRequestException(
          `Set ${index + 1} must have scores for both teams`,
        );
      }
      if (
        team0Score < 0 ||
        team1Score < 0 ||
        (!isDecidingSet && (team0Score > 7 || team1Score > 7))
      ) {
        throw new BadRequestException(`Set ${index + 1} score must be valid`);
      }

      if (useSuperTieBreak) {
        if (team0Score !== 0 || team1Score !== 0) {
          throw new BadRequestException(
            `Set ${index + 1} must be 0-0 for super tie-break`,
          );
        }
        if (!set.tiebreak || set.tiebreak.length === 0) {
          throw new BadRequestException(
            `Set ${index + 1} requires super tie-break scores`,
          );
        }
        const tiebreakScores = new Map<number, number>();
        set.tiebreak.forEach((game) => {
          if (game.teamIndex !== 0 && game.teamIndex !== 1) {
            throw new BadRequestException(
              `Set ${index + 1} tiebreak has invalid team index`,
            );
          }
          tiebreakScores.set(game.teamIndex, game.score);
        });
        const team0Tie = tiebreakScores.get(0);
        const team1Tie = tiebreakScores.get(1);
        if (team0Tie === undefined || team1Tie === undefined) {
          throw new BadRequestException(
            `Set ${index + 1} tiebreak must include both teams`,
          );
        }
        const diff = Math.abs(team0Tie - team1Tie);
        const target = decidingSetType === 'SUPER_TIEBREAK_10' ? 10 : 7;
        const maxTie = Math.max(team0Tie, team1Tie);
        if (diff < 2 || maxTie < target) {
          throw new BadRequestException(
            `Set ${index + 1} super tie-break must reach ${target} with 2-point lead`,
          );
        }
        teamWins[team0Tie > team1Tie ? 0 : 1] += 1;
        return;
      }

      const validateStandardTiebreak = (): number => {
        if (!set.tiebreak || set.tiebreak.length === 0) {
          throw new BadRequestException(
            `Set ${index + 1} requires tiebreak scores`,
          );
        }
        const tiebreakScores = new Map<number, number>();
        set.tiebreak.forEach((game) => {
          if (game.teamIndex !== 0 && game.teamIndex !== 1) {
            throw new BadRequestException(
              `Set ${index + 1} tiebreak has invalid team index`,
            );
          }
          tiebreakScores.set(game.teamIndex, game.score);
        });
        const team0Tie = tiebreakScores.get(0);
        const team1Tie = tiebreakScores.get(1);
        if (team0Tie === undefined || team1Tie === undefined) {
          throw new BadRequestException(
            `Set ${index + 1} tiebreak must include both teams`,
          );
        }
        const diff = Math.abs(team0Tie - team1Tie);
        const maxTie = Math.max(team0Tie, team1Tie);
        if (diff < 2 || maxTie < 7) {
          throw new BadRequestException(
            `Set ${index + 1} tiebreak must reach 7 with 2-point lead`,
          );
        }
        return team0Tie > team1Tie ? 0 : 1;
      };

      if (team0Score === team1Score) {
        if (team0Score !== 6) {
          throw new BadRequestException(
            `Set ${index + 1} cannot end in a draw unless 6-6`,
          );
        }
        const winner = validateStandardTiebreak();
        teamWins[winner] += 1;
        return;
      }

      if (set.tiebreak && set.tiebreak.length > 0) {
        const maxScore = Math.max(team0Score, team1Score);
        const minScore = Math.min(team0Score, team1Score);
        if (maxScore !== 7 || minScore !== 6) {
          throw new BadRequestException(
            `Set ${index + 1} cannot include tiebreak unless 6-6 or 7-6`,
          );
        }
        const winner = validateStandardTiebreak();
        const gamesWinner = team0Score > team1Score ? 0 : 1;
        if (winner !== gamesWinner) {
          throw new BadRequestException(
            `Set ${index + 1} tiebreak winner must match games winner`,
          );
        }
        teamWins[winner] += 1;
        return;
      }

      const maxScore = Math.max(team0Score, team1Score);
      const minScore = Math.min(team0Score, team1Score);
      if (isDecidingSet && decidingSetType === 'ADVANTAGE') {
        if (maxScore >= 6 && maxScore - minScore >= 2) {
          teamWins[team0Score > team1Score ? 0 : 1] += 1;
          return;
        }
        throw new BadRequestException(
          `Set ${index + 1} must finish with 2-game lead in advantage set`,
        );
      }
      if (maxScore === 6 && minScore <= 4) {
        teamWins[team0Score > team1Score ? 0 : 1] += 1;
        return;
      }
      if (maxScore === 7 && minScore === 5) {
        teamWins[team0Score > team1Score ? 0 : 1] += 1;
        return;
      }
      throw new BadRequestException(
        `Set ${index + 1} must finish 6-0..6-4 or 7-5 (tie-break at 6-6)`,
      );
    });

    let teamResult: Array<'WIN' | 'DRAW' | 'LOSS'> = ['DRAW', 'DRAW'];
    if (teamWins[0] !== teamWins[1]) {
      teamResult =
        teamWins[0] > teamWins[1] ? ['WIN', 'LOSS'] : ['LOSS', 'WIN'];
    }

    const participants = dto.teams.flatMap((team, teamIndex) =>
      team.players.map((playerId) => ({
        playerId,
        result: teamResult[teamIndex],
      })),
    );

    const matchCreated = new this.matchModel({
      ...dto,
      decidingSetType,
      participants,
      playedAt: dto.playedAt ? new Date(dto.playedAt) : new Date(),
    });
    const persisted = await matchCreated.save();
    const matchId = this.toId(persisted._id);
    const tenant = this.tenancyService.tenant ?? 'unknown';
    this.logDomainEvent('match.created', {
      matchId,
      tenant,
      categoryId: this.toId(persisted.categoryId),
    });
    this.logDomainEvent('match.confirmed', {
      matchId,
      tenant,
      categoryId: this.toId(persisted.categoryId),
    });
    this.auditService.audit(AuditEvent.MATCH_CREATED, context, {
      targetIds: [matchId],
      categoryId: this.toId(persisted.categoryId),
      clubId: this.toId(persisted.clubId),
    });
    return persisted;
  }

  private buildDateFilter(from?: string, to?: string): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (!from && !to) {
      return filter;
    }
    const range: Record<string, Date> = {};
    if (from) {
      const fromDate = new Date(`${from}T00:00:00`);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException('Invalid from date format');
      }
      range.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(`${to}T23:59:59`);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid to date format');
      }
      range.$lte = toDate;
    }
    if (Object.keys(range).length > 0) {
      filter.playedAt = range;
    }
    return filter;
  }

  async getMatches(
    query: ListMatchesQueryDto,
    context: AccessContext,
  ): Promise<PaginatedResult<Match>> {
    const filter: Record<string, unknown> = {
      ...this.buildDateFilter(query.from, query.to),
    };
    const scopedClubId = this.resolveClubScope(context, query.clubId);
    if (scopedClubId) {
      filter.clubId = scopedClubId;
    }
    if (query.categoryId) {
      await this.ensureCategoryExists(query.categoryId, context);
      filter.categoryId = query.categoryId;
    }
    return await this.paginateMatches(filter, query.page, query.limit);
  }

  private normalizeDecidingSetType(value: unknown): DecidingSetType {
    if (
      value === 'STANDARD' ||
      value === 'ADVANTAGE' ||
      value === 'SUPER_TIEBREAK_7' ||
      value === 'SUPER_TIEBREAK_10'
    ) {
      return value;
    }
    return 'STANDARD';
  }

  private logDomainEvent(
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.logger.debug('match.domain', {
      event,
      ...payload,
    });
  }

  private async paginateMatches(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { playedAt: -1, createdAt: -1 },
  ): Promise<PaginatedResult<Match>> {
    const {
      page: safePage,
      limit: safeLimit,
      skip,
    } = clampPagination({
      page,
      limit,
    });
    const queryFilter = filter as Record<string, never>;
    const [items, total] = await Promise.all([
      this.matchModel
        .find(queryFilter)
        .sort(sort)
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.matchModel.countDocuments(queryFilter),
    ]);
    return { items, page: safePage, limit: safeLimit, total };
  }

  private toId(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (
      value &&
      typeof (value as { toString: () => string }).toString === 'function'
    ) {
      return (value as { toString: () => string }).toString();
    }
    return '';
  }

  async getMatchesByCategory(
    categoryId: string,
    query: ListMatchesByCategoryQueryDto,
    context: AccessContext,
    playerId?: string,
  ): Promise<PaginatedResult<Match>> {
    await this.ensureCategoryExists(categoryId, context);
    const filter: Record<string, unknown> = {
      categoryId,
      ...this.buildDateFilter(query.from, query.to),
    };
    if (context.role === Roles.CLUB) {
      filter.clubId = context.clubId;
    }
    if (playerId) {
      filter['participants.playerId'] = playerId;
    }
    return await this.paginateMatches(filter, query.page, query.limit);
  }

  async ensurePlayerInCategory(
    categoryId: string,
    playerId: string,
  ): Promise<void> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }
    const hasPlayer = category.players?.some((player) => {
      const raw = (player as { _id?: unknown })._id ?? player;
      return this.toId(raw) === this.toId(playerId);
    });
    if (!hasPlayer) {
      throw new BadRequestException('Player is not in this category');
    }
  }

  async getRankingByCategory(
    categoryId: string,
    query: ListRankingQueryDto,
    context: AccessContext,
  ): Promise<PaginatedResult<RankingEntry>> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }
    this.ensureCategoryAccess(category, context);

    const matches = await this.matchModel
      .find({ categoryId })
      .sort({ playedAt: 1, createdAt: 1 })
      .lean()
      .exec();

    if (matches.length === 0) {
      return {
        items: [],
        page: query.page,
        limit: query.limit,
        total: 0,
      };
    }

    const ratingMap = new Map<
      string,
      {
        rating: number;
        wins: number;
        losses: number;
        draws: number;
        matches: number;
        lastMatchAt: Date | null;
      }
    >();

    matches.forEach((match) => {
      if (!match.teams || match.teams.length !== 2) {
        return;
      }
      const participantResults = new Map<string, 'WIN' | 'DRAW' | 'LOSS'>();
      (match.participants ?? []).forEach((participant) => {
        participantResults.set(
          this.toId(participant.playerId),
          participant.result,
        );
      });

      const teamScores = match.teams.map((team) => {
        if (!team.players || team.players.length === 0) {
          return 0.5;
        }
        const firstPlayer = this.toId(team.players[0]);
        const result = participantResults.get(firstPlayer) ?? 'DRAW';
        return RESULT_TO_SCORE[result];
      });

      const teamRatings = match.teams.map((team) => {
        const members = team.players ?? [];
        if (members.length === 0) {
          return ELO_INITIAL_RATING;
        }
        const total = members.reduce((sum, playerId) => {
          const id = this.toId(playerId);
          const state = this.getOrCreateRatingState(ratingMap, id);
          return sum + state.rating;
        }, 0);
        return total / members.length;
      });

      const kFactor =
        match.format === 'DOUBLES' ? ELO_K_DOUBLES : ELO_K_SINGLES;
      const expectedTeamA =
        1 / (1 + Math.pow(10, (teamRatings[1] - teamRatings[0]) / 400));
      const expectedTeamB = 1 - expectedTeamA;
      const actualTeamA = teamScores[0];
      const actualTeamB = teamScores[1];
      const deltaA = kFactor * (actualTeamA - expectedTeamA);
      const deltaB = kFactor * (actualTeamB - expectedTeamB);
      const matchDate =
        this.coerceDate(match.playedAt) ??
        this.coerceDate(match.createdAt) ??
        new Date();

      match.teams.forEach((team, index) => {
        const delta = index === 0 ? deltaA : deltaB;
        const score = teamScores[index];
        const members = team.players ?? [];
        members.forEach((playerId) => {
          const id = this.toId(playerId);
          const state = this.getOrCreateRatingState(ratingMap, id);
          state.rating += delta;
          state.matches += 1;
          state.lastMatchAt = matchDate;
          if (score === 1) {
            state.wins += 1;
          } else if (score === 0) {
            state.losses += 1;
          } else {
            state.draws += 1;
          }
        });
      });
    });

    const playerIds = Array.from(ratingMap.keys());
    const players = await this.playerModel
      .find({ _id: { $in: playerIds } })
      .lean()
      .exec();
    const playerMap = new Map(
      players.map((player) => [this.toId(player._id), player]),
    );

    const ranking = playerIds
      .map((playerId) => ({ playerId, state: ratingMap.get(playerId)! }))
      .sort((a, b) => b.state.rating - a.state.rating)
      .map((entry, index) => {
        const player = playerMap.get(entry.playerId);
        return {
          _id: entry.playerId,
          email: player?.email ?? '',
          phone: player?.phone ?? '',
          clubId: player ? this.toId(player.clubId) : '',
          name: player?.name ?? 'Unknown Player',
          rating: Math.round(entry.state.rating * 100) / 100,
          position: index + 1,
          pictureUrl: player?.pictureUrl ?? '',
          wins: entry.state.wins,
          losses: entry.state.losses,
          draws: entry.state.draws,
          matches: entry.state.matches,
          lastMatchAt: entry.state.lastMatchAt,
        };
      });

    this.logDomainEvent('ranking.rebuild', {
      categoryId,
      players: ranking.length,
      matches: matches.length,
      tenant: this.tenancyService.tenant ?? 'unknown',
    });

    const filtered = this.applyRankingSearch(ranking, query.q);
    const { page, limit } = clampPagination(query);
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return {
      items,
      page,
      limit,
      total: filtered.length,
    };
  }

  private getOrCreateRatingState(
    ratingMap: Map<
      string,
      {
        rating: number;
        wins: number;
        losses: number;
        draws: number;
        matches: number;
        lastMatchAt: Date | null;
      }
    >,
    playerId: string,
  ) {
    if (!ratingMap.has(playerId)) {
      ratingMap.set(playerId, {
        rating: ELO_INITIAL_RATING,
        wins: 0,
        losses: 0,
        draws: 0,
        matches: 0,
        lastMatchAt: null,
      });
    }
    return ratingMap.get(playerId)!;
  }

  private resolveClubScope(
    context: AccessContext,
    requestedClubId?: string,
  ): string | undefined {
    if (context.role === Roles.SYSTEM_ADMIN) {
      return requestedClubId;
    }
    const clubId = context.clubId;
    if (!clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }
    if (requestedClubId && requestedClubId !== clubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }
    return clubId;
  }

  private applyRankingSearch(
    ranking: RankingEntry[],
    term?: string,
  ): RankingEntry[] {
    const normalized = term?.trim().toLowerCase();
    if (!normalized) {
      return ranking;
    }
    return ranking.filter((entry) => {
      const haystacks = [entry.name, entry.email];
      return haystacks.some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }

  private coerceDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value as string | number | Date);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private ensureClubAccess(context: AccessContext, targetClubId: string): void {
    if (context.role === Roles.SYSTEM_ADMIN) {
      return;
    }
    if (!context.clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }
    if (context.clubId !== targetClubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }
  }

  private async ensureCategoryExists(
    categoryId: string,
    context: AccessContext,
  ): Promise<Category> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }
    this.ensureCategoryAccess(category, context);
    return category;
  }

  private ensureCategoryAccess(
    category: Category,
    context: AccessContext,
  ): void {
    if (context.role === Roles.SYSTEM_ADMIN) {
      return;
    }
    if (!context.clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }
    if (this.toId(category.clubId) !== context.clubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }
  }
}
