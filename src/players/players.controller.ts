import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { PlayersService } from './players.service';
import { Player } from './interfaces/players.interface';
import { PlayersValidationParamPipe } from './pipes/players-validation-param.pipe';

@Controller('api/v1/players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}
  @Post()
  @UsePipes(ValidationPipe)
  async createPlayer(@Body() createPlayerDto: CreatePlayerDto) {
    await this.playersService.createOrUpdatePlayer(createPlayerDto);
  }

  @Get()
  async getAllPlayers(): Promise<Player[]> {
    return await this.playersService.getAllPlayers();
  }

  @Get('by-email')
  async getPlayerByEmail(
    @Query('email', PlayersValidationParamPipe) email: string,
  ): Promise<Player> {
    if (email) {
      return await this.playersService.getPlayerByEmail(email);
    } else {
      throw new BadRequestException('Email query parameter is required');
    }
  }

  @Get('by-phone')
  async getPlayerByPhone(@Query('phone') phone: string): Promise<Player> {
    if (phone) {
      return await this.playersService.getPlayerByPhone(phone);
    } else {
      throw new BadRequestException('Phone query parameter is required');
    }
  }

  @Delete()
  async deletePlayer(
    @Query('email', PlayersValidationParamPipe) email: string,
  ): Promise<void> {
    await this.playersService.deletePlayer(email);
  }
}
