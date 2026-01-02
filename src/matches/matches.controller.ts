import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/roles';
import { RequireRoles } from '../auth/roles.decorator';
import { CreateMatchDto } from './dtos/create-match.dto';
import { MatchesService } from './matches.service';
import type { AccessContext } from '../auth/access-context.types';
import { ListMatchesQueryDto } from './dtos/list-matches.query';
import { ListMatchesByCategoryQueryDto } from './dtos/list-matches-by-category.query';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import type { Match } from './interfaces/match.interface';
import { ListRankingQueryDto } from './dtos/list-ranking.query';
import type { RankingEntry } from './interfaces/ranking-entry.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

type RequestWithContext = Request & { accessContext?: AccessContext | null };

@ApiTags('Matches')
@ApiCookieAuth('SessionCookie')
@ApiSecurity('Tenant')
@Controller('api/v1/matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  private getAccessContext(req: Request): AccessContext {
    const context = (req as RequestWithContext).accessContext;
    if (!context) {
      throw new ForbiddenException('Access context missing');
    }
    return context;
  }

  @Post()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  @UsePipes(ValidationPipe)
  async createMatch(@Req() req: Request, @Body() dto: CreateMatchDto) {
    return await this.matchesService.createMatch(
      dto,
      this.getAccessContext(req),
    );
  }

  @Get()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getMatches(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListMatchesQueryDto,
  ): Promise<PaginatedResult<Match>> {
    return await this.matchesService.getMatches(
      query,
      this.getAccessContext(req),
    );
  }

  @Get('by-category/:categoryId')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER)
  async getMatchesByCategory(
    @Param('categoryId', ParseMongoIdPipe) categoryId: string,
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListMatchesByCategoryQueryDto,
  ): Promise<PaginatedResult<Match>> {
    const context = this.getAccessContext(req);
    let playerId: string | undefined;
    if (context.role === Roles.PLAYER) {
      playerId = context.playerId;
      if (!playerId) {
        throw new ForbiddenException('Player profile not linked');
      }
      await this.matchesService.ensurePlayerInCategory(categoryId, playerId);
    }
    return await this.matchesService.getMatchesByCategory(
      categoryId,
      query,
      context,
      playerId,
    );
  }

  @Get('ranking/:categoryId')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getRankingByCategory(
    @Param('categoryId', ParseMongoIdPipe) categoryId: string,
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListRankingQueryDto,
  ): Promise<PaginatedResult<RankingEntry>> {
    return await this.matchesService.getRankingByCategory(
      categoryId,
      query,
      this.getAccessContext(req),
    );
  }
}
