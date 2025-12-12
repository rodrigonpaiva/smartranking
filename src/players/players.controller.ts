import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { PlayersService } from './players.service';
import { Player } from './interfaces/players.interface';

@Controller('api/v1/players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}
  @Post()
  async createPlayer(@Body() createPlayerDto: CreatePlayerDto) {
    await this.playersService.createOrUpdatePlayer(createPlayerDto);
  }

  @Get()
  async getAllPlayers(): Promise<Player[]> {
    return await this.playersService.getAllPlayers();
  }

  @Get()
  async getPlayers(@Query('email') email: string): Promise<Player | Player[]> {
    if (email) {
      return await this.playersService.getPlayerByEmail(email);
    } else {
      return await this.playersService.getAllPlayers();
    }
  }

  @Get()
  async getPlayerByPhone(@Query('phone') phone: string): Promise<Player> {
    return await this.playersService.getPlayerByPhone(phone);
  }

  @Delete()
  async deletePlayer(@Query('email') email: string): Promise<void> {
    await this.playersService.deletePlayer(email);
  }
}
