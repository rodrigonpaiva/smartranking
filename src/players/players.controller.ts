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
import { Request } from 'express';
import { RequireRoles } from '../auth/roles.decorator';
import { Roles } from '../auth/roles';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { PlayersService } from './players.service';
import { Player } from './interfaces/players.interface';
import { ValidationParamPipe } from '../common/pipes/validation-param.pipe';
import { UpdatePlayerDto } from './dtos/update-player.dto';
import { GetPlayerByPhoneQueryDto } from './dtos/get-player-by-phone.dto';

@RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
@Controller('api/v1/players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}
  @Post()
  @UsePipes(ValidationPipe)
  async createPlayer(
    @Body() createPlayerDto: CreatePlayerDto,
  ): Promise<Player> {
    return await this.playersService.createPlayer(createPlayerDto);
  }

  @Get()
  async getAllPlayers(): Promise<Player[]> {
    return await this.playersService.getAllPlayers();
  }

  @Get('search')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async searchPlayers(
    @Req() req: Request & { userProfile?: { role?: string; clubId?: string } },
    @Query('q') q?: string,
    @Query('clubId') clubId?: string,
  ): Promise<Player[]> {
    const query = (q ?? '').trim();
    if (!query) return [];
    const requesterClubId = req.userProfile?.clubId;
    if (req.userProfile?.role === Roles.CLUB) {
      if (!requesterClubId) {
        throw new ForbiddenException('User is not assigned to a club');
      }
      return await this.playersService.searchPlayers(query, requesterClubId);
    }
    return await this.playersService.searchPlayers(query, clubId);
  }

  @Get('by-email/:email')
  async getPlayerByEmail(
    @Param('email', ValidationParamPipe) email: string,
  ): Promise<Player> {
    return await this.playersService.getPlayerByEmail(email);
  }

  @Get('by-club/:clubId')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER)
  async getPlayersByClub(
    @Param('clubId', ValidationParamPipe) clubId: string,
    @Req() req: Request & { userProfile?: { role?: string; clubId?: string } },
  ): Promise<Player[]> {
    const requesterClubId = req.userProfile?.clubId;
    if (
      (req.userProfile?.role === Roles.PLAYER ||
        req.userProfile?.role === Roles.CLUB) &&
      requesterClubId &&
      requesterClubId !== clubId
    ) {
      throw new ForbiddenException('Club not allowed for this user');
    }
    return await this.playersService.getPlayersByClubId(clubId);
  }

  @Get('by-phone')
  async getPlayerByPhone(
    @Query(new ValidationPipe({ transform: true }))
    query: GetPlayerByPhoneQueryDto,
  ): Promise<Player> {
    return await this.playersService.getPlayerByPhone(query.phone);
  }

  @Get(':_id')
  async getPlayerByid(
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<Player> {
    return await this.playersService.getPlayerById(_id);
  }

  @Put('/:_id')
  @UsePipes(ValidationPipe)
  async updatePlayer(
    @Body() updatePlayer: UpdatePlayerDto,
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<Player> {
    return await this.playersService.updatePlayer(_id, updatePlayer);
  }

  @Delete('/:_id')
  async deletePlayer(
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<void> {
    await this.playersService.deletePlayer(_id);
  }
}
