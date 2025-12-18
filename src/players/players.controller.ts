import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { PlayersService } from './players.service';
import { Player } from './interfaces/players.interface';
import { ValidationParamPipe } from '../common/pipes/validation-param.pipe';
import { UpdatePlayerDto } from './dtos/update-player.dto';

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

  @Get('by-email/:email')
  async getPlayerByEmail(
    @Param('email', ValidationParamPipe) email: string,
  ): Promise<Player> {
    return await this.playersService.getPlayerByEmail(email);
  }

  @Get('/:_id')
  async getPlayerByid(
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<Player> {
    return await this.playersService.getPlayerById(_id);
  }

  @Get('by-phone')
  async getPlayerByPhone(@Query('phone') phone: string): Promise<Player> {
    return await this.playersService.getPlayerByPhone(phone);
  }

  @Put('/:_id')
  @UsePipes(ValidationPipe)
  async updatePlayer(
    @Body() updatePlayer: UpdatePlayerDto,
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<void> {
    await this.playersService.updatePlayer(_id, updatePlayer);
  }

  @Delete('/:_id')
  async deletePlayer(
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<void> {
    await this.playersService.deletePlayer(_id);
  }
}
