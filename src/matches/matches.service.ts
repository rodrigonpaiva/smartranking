import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from '../categories/interfaces/category.interface';
import { Club } from '../clubs/interfaces/club.interface';
import { Player } from '../players/interfaces/players.interface';
import { CreateMatchDto } from './dtos/create-match.dto';
import { Match } from './interfaces/match.interface';

const POINTS_BY_RESULT: Record<'WIN' | 'DRAW' | 'LOSS', number> = {
  WIN: 30,
  DRAW: 10,
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
  ) {}

  async createMatch(dto: CreateMatchDto): Promise<Match> {
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
    return await matchCreated.save();
  }

  private buildDateFilter(
    dateFrom?: string,
    dateTo?: string,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (!dateFrom && !dateTo) {
      return filter;
    }
    const range: Record<string, Date> = {};
    if (dateFrom) {
      const fromDate = new Date(`${dateFrom}T00:00:00`);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException('Invalid dateFrom format');
      }
      range.$gte = fromDate;
    }
    if (dateTo) {
      const toDate = new Date(`${dateTo}T23:59:59`);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid dateTo format');
      }
      range.$lte = toDate;
    }
    if (Object.keys(range).length > 0) {
      filter.playedAt = range;
    }
    return filter;
  }

  async getMatches(
    categoryId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Match[]> {
    const filter = this.buildDateFilter(dateFrom, dateTo);
    if (categoryId) {
      return await this.matchModel
        .find({ categoryId, ...filter })
        .sort({ playedAt: -1 })
        .exec();
    }
    return await this.matchModel.find(filter).sort({ playedAt: -1 }).exec();
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
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Match[]> {
    const filter = this.buildDateFilter(dateFrom, dateTo);
    return await this.matchModel
      .find({ categoryId, ...filter })
      .sort({ playedAt: -1 })
      .exec();
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

  async getRankingByCategory(categoryId: string): Promise<
    Array<{
      _id: string;
      email: string;
      phone: string;
      clubId: string;
      name: string;
      ranking: number;
      position: number;
      pictureUrl: string;
      points: number;
    }>
  > {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }

    const matches = await this.matchModel.find({ categoryId }).exec();
    const pointsMap = new Map<string, number>();

    matches.forEach((match) => {
      match.participants?.forEach((participant) => {
        const points = POINTS_BY_RESULT[participant.result] ?? 0;
        const key = this.toId(participant.playerId);
        pointsMap.set(key, (pointsMap.get(key) ?? 0) + points);
      });
    });

    if (pointsMap.size === 0) {
      return [];
    }

    const players = await this.playerModel
      .find({ _id: { $in: Array.from(pointsMap.keys()) } })
      .exec();

    return players
      .map((player) => {
        const playerId = this.toId(player._id);
        const data = player.toObject();

        return {
          _id: playerId,
          email: data.email,
          phone: data.phone,
          clubId: this.toId(data.clubId),
          name: data.name,
          ranking: data.ranking,
          position: data.position,
          pictureUrl: data.pictureUrl,
          points: pointsMap.get(playerId) ?? 0,
        };
      })
      .sort((a, b) => b.points - a.points);
  }
}
