import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequireRoles } from '../auth/roles.decorator';
import { Roles } from '../auth/roles';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { PlayersService } from './players.service';
import { Player } from './interfaces/players.interface';
import { ValidationParamPipe } from '../common/pipes/validation-param.pipe';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { UpdatePlayerDto } from './dtos/update-player.dto';
import { GetPlayerByPhoneQueryDto } from './dtos/get-player-by-phone.dto';
import type { AccessContext } from '../auth/access-context.types';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListPlayersQueryDto } from './dtos/list-players.query';
import { PaginationQueryDto } from '../common/dtos/pagination-query.dto';

type RequestWithContext = Request & { accessContext?: AccessContext | null };

@ApiTags('Players')
@ApiCookieAuth('SessionCookie')
@ApiSecurity('Tenant')
@Controller('api/v1/players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

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
  async createPlayer(
    @Req() req: Request,
    @Body() createPlayerDto: CreatePlayerDto,
  ): Promise<Player> {
    return await this.playersService.createPlayer(
      createPlayerDto,
      this.getAccessContext(req),
    );
  }

  @Get()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getAllPlayers(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListPlayersQueryDto,
  ): Promise<PaginatedResult<Player>> {
    return await this.playersService.getAllPlayers(
      query,
      this.getAccessContext(req),
    );
  }

  @Get('search')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async searchPlayers(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListPlayersQueryDto,
  ): Promise<PaginatedResult<Player>> {
    return await this.playersService.searchPlayers(
      query,
      this.getAccessContext(req),
    );
  }

  @Get('by-email/:email')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getPlayerByEmail(
    @Req() req: Request,
    @Param('email', ValidationParamPipe) email: string,
  ): Promise<Player> {
    return await this.playersService.getPlayerByEmail(
      email,
      this.getAccessContext(req),
    );
  }

  @Get('by-club/:clubId')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER)
  async getPlayersByClub(
    @Param('clubId', ParseMongoIdPipe) clubId: string,
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Player>> {
    const context = this.getAccessContext(req);
    return await this.playersService.getPlayersByClubId(clubId, context, query);
  }

  @Get('by-phone')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getPlayerByPhone(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true }))
    query: GetPlayerByPhoneQueryDto,
  ): Promise<Player> {
    return await this.playersService.getPlayerByPhone(
      query.phone,
      this.getAccessContext(req),
    );
  }

  @Get(':_id')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getPlayerByid(
    @Req() req: Request,
    @Param('_id', ParseMongoIdPipe) _id: string,
  ): Promise<Player> {
    return await this.playersService.getPlayerById(
      _id,
      this.getAccessContext(req),
    );
  }

  @Put('/:_id')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  @UsePipes(ValidationPipe)
  async updatePlayer(
    @Req() req: Request,
    @Body() updatePlayer: UpdatePlayerDto,
    @Param('_id', ParseMongoIdPipe) _id: string,
  ): Promise<Player> {
    return await this.playersService.updatePlayer(
      _id,
      updatePlayer,
      this.getAccessContext(req),
    );
  }

  @Delete('/:_id')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async deletePlayer(
    @Req() req: Request,
    @Param('_id', ParseMongoIdPipe) _id: string,
  ): Promise<void> {
    await this.playersService.deletePlayer(_id, this.getAccessContext(req));
  }
}
