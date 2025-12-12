import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { Player } from './interfaces/players.interface';
import * as uuid from 'uuid';
import { UpdatePlayerDto } from './dtos/update-player.dto';

@Injectable()
export class PlayersService {
  private players: Player[] = [];

  private readonly logger = new Logger(PlayersService.name);
  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<void> {
    const { email } = createPlayerDto;
    const playerExists = this.players.find((player) => player.email === email);
    if(playerExists){
      this.refresh(playerExists, createPlayerDto);
    }else{
      this.create(createPlayerDto);
    }
  }
  async getAllPlayers(): Promise<Player[]> {
    return this.players;
  }

  async getPlayerByEmail(email: string): Promise<Player> {
    const playersFound = this.players.find(player => player.email === email);
    if (!playersFound) {
      throw new NotFoundException(`No players found with email: ${email}`);
    }
    return playersFound;

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

  async deletePlayer(email): Promise<void> {
    const playersFound = await this.players.find(player => player.email === email); 
    if (playersFound) {
      this.players = this.players.filter(player => player.email !== playersFound.email);
    } else {
      throw new NotFoundException(`No players found with email: ${email}`);
    }
  }
}
