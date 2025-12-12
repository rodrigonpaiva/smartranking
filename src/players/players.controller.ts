import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
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

  @Get('email/:email')
  async getPlayerByEmail(@Param('email') email: string): Promise<Player> {
    return await this.playersService.getPlayerByEmail(email);
  }

  @Get('phone/:phone')
  async getPlayerByPhone(@Param('phone') phone: string): Promise<Player> {
    return await this.playersService.getPlayerByPhone(phone);
  }

  @Delete('email/:email')
  async deletePlayer(@Param('email') email: string): Promise<void> {
    await this.playersService.deletePlayer(email);
  }
}
