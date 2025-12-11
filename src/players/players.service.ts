import { Injectable, Logger } from '@nestjs/common';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { Player } from './interfaces/players.interface';
import * as uuid from 'uuid';

@Injectable()
export class PlayersService {
  private players: Player[] = [];

  private readonly logger = new Logger(PlayersService.name);
  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<void> {
    const { email } = createPlayerDto;
    const playerExists = this.players.find((player) => player.email === email);
    if(playerExists){
      await this.refresh(playerExists, createPlayerDto);
    }else{
    await this.create(createPlayerDto);
    }
  }
  async getAllPlayers(): Promise<Player[]> {
    return await this.players;
  }
  private create(createPlayerDto: CreatePlayerDto): void {
    const { name, phone, email } = createPlayerDto;
    const player: Player = {
      _id: uuid.v4(),
      name,
      phone,
      email,
      ranking: 'A',
      position: this.players.length + 1,
      pictureUrl: 'www.google.com.br/foto123.jpg',
    };
    this.logger.log(`Creating player with data:${JSON.stringify(player)}`);
    this.players.push(player);
  }

  private refresh(
    playerExists: Player,
    createPlayerDto: CreatePlayerDto,
  ): void {
    const { name } = createPlayerDto;
    playerExists.name = name;
  }
}
