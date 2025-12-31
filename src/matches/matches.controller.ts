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
import { Request } from 'express';
import { Roles } from '../auth/roles';
import { RequireRoles } from '../auth/roles.decorator';
import { CreateMatchDto } from './dtos/create-match.dto';
import { MatchesService } from './matches.service';

type RequestWithProfile = Request & {
  userProfile?: {
    role: string;
    playerId?: string;
  };
};

@Controller('api/v1/matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  @UsePipes(ValidationPipe)
  async createMatch(@Body() dto: CreateMatchDto) {
    return await this.matchesService.createMatch(dto);
  }

  @Get()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getMatches(
    @Query('categoryId') categoryId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return await this.matchesService.getMatches(categoryId, dateFrom, dateTo);
  }

  @Get('by-category/:categoryId')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER)
  async getMatchesByCategory(
    @Param('categoryId') categoryId: string,
    @Req() req: RequestWithProfile,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if (req.userProfile?.role === Roles.PLAYER) {
      const playerId = req.userProfile.playerId;
      if (!playerId) {
        throw new ForbiddenException('Player profile not linked');
      }
      await this.matchesService.ensurePlayerInCategory(categoryId, playerId);
    }
    return await this.matchesService.getMatchesByCategory(
      categoryId,
      dateFrom,
      dateTo,
    );
  }

  @Get('ranking/:categoryId')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER)
  async getRankingByCategory(
    @Param('categoryId') categoryId: string,
    @Req() req: RequestWithProfile,
  ) {
    if (req.userProfile?.role === Roles.PLAYER) {
      const playerId = req.userProfile.playerId;
      if (!playerId) {
        throw new ForbiddenException('Player profile not linked');
      }
      await this.matchesService.ensurePlayerInCategory(categoryId, playerId);
    }
    return await this.matchesService.getRankingByCategory(categoryId);
  }
}
