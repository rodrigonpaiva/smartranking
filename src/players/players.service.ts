import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { UpdatePlayerDto } from './dtos/update-player.dto';
import { Player } from './interfaces/players.interface';
import { Club } from '../clubs/interfaces/club.interface';
import type { AccessContext } from '../auth/access-context.types';
import { Roles } from '../auth/roles';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListPlayersQueryDto } from './dtos/list-players.query';
import { PaginationQueryDto } from '../common/dtos/pagination-query.dto';
import { AuditService } from '../audit/audit.service';
import { AuditEvent } from '../audit/audit.events';
import { clampPagination } from '../common/pagination/pagination.util';

@Injectable()
export class PlayersService {
  constructor(
    @InjectModel('Player') private readonly playerModel: Model<Player>,
    @InjectModel('Club') private readonly clubModel: Model<Club>,
    private readonly auditService: AuditService,
  ) {}

  async createPlayer(
    createPlayerDto: CreatePlayerDto,
    context: AccessContext,
  ): Promise<Player> {
    const scopedClubId = this.resolveClubScope(context, createPlayerDto.clubId);
    if (!scopedClubId) {
      throw new BadRequestException('clubId is required for this action');
    }
    const { email } = createPlayerDto;
    const clubExists = await this.clubModel.findById(scopedClubId).exec();
    if (!clubExists) {
      throw new NotFoundException(`Club with id ${scopedClubId} not found`);
    }
    const playerExists = await this.playerModel
      .findOne({ email, clubId: scopedClubId })
      .exec();
    if (playerExists) {
      throw new BadRequestException(
        `Player with email ${email} already exists`,
      );
    }
    const playerCreated = new this.playerModel({
      ...createPlayerDto,
      clubId: scopedClubId,
    });
    const savedPlayer = await playerCreated.save();
    this.auditService.audit(AuditEvent.PLAYER_CREATED, context, {
      targetIds: savedPlayer._id ? [savedPlayer._id.toString()] : [],
      clubId: scopedClubId,
    });
    return savedPlayer;
  }

  async getAllPlayers(
    query: ListPlayersQueryDto,
    context: AccessContext,
  ): Promise<PaginatedResult<Player>> {
    const filter: Record<string, unknown> = {};
    const scopedClubId = this.resolveClubScope(context, query.clubId, {
      allowBlankForAdmin: true,
    });
    if (scopedClubId) {
      filter.clubId = scopedClubId;
    }
    if (query.q) {
      filter.$or = this.buildSearchFilter(query.q);
    }
    return await this.paginatePlayers(filter, query.page, query.limit);
  }

  async getPlayersByClubId(
    clubId: string,
    context: AccessContext,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<Player>> {
    this.ensureClubAccess(context, clubId);
    return await this.paginatePlayers(
      { clubId } as Record<string, unknown>,
      pagination.page,
      pagination.limit,
      { name: 1 },
    );
  }

  async searchPlayers(
    query: ListPlayersQueryDto,
    context: AccessContext,
  ): Promise<PaginatedResult<Player>> {
    if (!query.q?.trim()) {
      return { items: [], page: query.page, limit: query.limit, total: 0 };
    }
    return await this.getAllPlayers(query, context);
  }

  async updatePlayer(
    _id: string,
    updatePlayer: UpdatePlayerDto,
    context: AccessContext,
  ): Promise<Player> {
    const player = await this.ensurePlayerAccess(_id, context);
    const updated = await this.playerModel
      .findOneAndUpdate(
        { _id: player._id },
        { $set: updatePlayer },
        { new: true },
      )
      .exec();
    this.auditService.audit(AuditEvent.PLAYER_UPDATED, context, {
      targetIds: [(updated?._id ?? player._id).toString()],
    });
    return updated as Player;
  }

  async getPlayerById(_id: string, context?: AccessContext): Promise<Player> {
    return await this.ensurePlayerAccess(_id, context);
  }

  async getPlayerByEmail(
    email: string,
    context?: AccessContext,
  ): Promise<Player> {
    const playerFound = await this.playerModel.findOne({ email }).exec();
    if (!playerFound) {
      throw new NotFoundException(`No players found with email: ${email}`);
    }
    this.ensurePlayerClubMatch(playerFound, context);
    return playerFound;
  }

  async getPlayerByPhone(
    phone: string,
    context?: AccessContext,
  ): Promise<Player> {
    const playerFound = await this.playerModel.findOne({ phone }).exec();
    if (!playerFound) {
      throw new NotFoundException(`No players found with phone: ${phone}`);
    }
    this.ensurePlayerClubMatch(playerFound, context);
    return playerFound;
  }

  async deletePlayer(_id: string, context: AccessContext): Promise<void> {
    const player = await this.ensurePlayerAccess(_id, context);
    await this.playerModel.deleteOne({ _id: player._id }).exec();
    this.auditService.audit(AuditEvent.PLAYER_DELETED, context, {
      targetIds: [player._id?.toString() ?? _id],
    });
  }

  private resolveClubScope(
    context: AccessContext,
    requestedClubId?: string,
    options: { allowBlankForAdmin?: boolean } = {},
  ): string | undefined {
    if (context.role === Roles.SYSTEM_ADMIN) {
      if (!requestedClubId && !options.allowBlankForAdmin) {
        throw new BadRequestException('clubId is required for this action');
      }
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

  private ensureClubAccess(context: AccessContext, targetClubId: string): void {
    if (context.role === Roles.SYSTEM_ADMIN) {
      return;
    }
    const clubId = context.clubId;
    if (!clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }
    if (clubId !== targetClubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }
  }

  private ensurePlayerClubMatch(player: Player, context?: AccessContext): void {
    if (!context || context.role === Roles.SYSTEM_ADMIN) {
      return;
    }
    const clubId = context.clubId;
    if (!clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }
    if (String(player.clubId) !== clubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }
  }

  private async ensurePlayerAccess(
    playerId: string,
    context?: AccessContext,
  ): Promise<Player> {
    const playerFound = await this.playerModel.findById(playerId).exec();
    if (!playerFound) {
      throw new NotFoundException(`Player with id ${playerId} not found`);
    }
    this.ensurePlayerClubMatch(playerFound, context);
    return playerFound;
  }

  private buildSearchFilter(q: string): Array<Record<string, unknown>> {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    return [{ name: regex }, { email: regex }];
  }

  private async paginatePlayers(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { createdAt: -1 },
  ): Promise<PaginatedResult<Player>> {
    const {
      page: safePage,
      limit: safeLimit,
      skip,
    } = clampPagination({
      page,
      limit,
    });
    const queryFilter = filter as Record<string, never>;
    const baseQuery = this.playerModel
      .find(queryFilter)
      .sort(sort)
      .skip(skip)
      .limit(safeLimit);
    const [items, total] = await Promise.all([
      baseQuery.exec(),
      this.playerModel.countDocuments(queryFilter),
    ]);
    return { items, page: safePage, limit: safeLimit, total };
  }
}
