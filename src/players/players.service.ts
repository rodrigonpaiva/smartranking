import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { Player } from './interfaces/players.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class PlayersService {
  constructor(
    @InjectModel('Player') private readonly playerModel: Model<Player>,
  ) {}

  async createOrUpdatePlayer(createPlayerDto: CreatePlayerDto): Promise<void> {
    const { email } = createPlayerDto;
    const playerExists = await this.playerModel.findOne({ email }).exec();
    if (playerExists) {
      await this.update(createPlayerDto);
    } else {
      await this.create(createPlayerDto);
    }
  }
  async getAllPlayers(): Promise<Player[]> {
    return await this.playerModel.find().exec();
  }

  async getPlayerByEmail(email: string): Promise<Player> {
    const playerFound = await this.playerModel.findOne({ email }).exec();
    if (!playerFound) {
      throw new NotFoundException(`No players found with email: ${email}`);
    }
    return playerFound;
  }

  async getPlayerByPhone(phone: string): Promise<Player> {
    const playerFound = await this.playerModel.findOne({ phone }).exec();
    if (!playerFound) {
      throw new NotFoundException(`No players found with phone: ${phone}`);
    }
    return playerFound;
  }

  private async create(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const playerCreated = new this.playerModel(createPlayerDto);
    return await playerCreated.save();
  }

  private async update(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const playerUpdated = await this.playerModel
      .findOneAndUpdate(
        { email: createPlayerDto.email },
        { $set: createPlayerDto },
      )
      .exec();
    if (!playerUpdated) {
      throw new NotFoundException(
        `Player with email ${createPlayerDto.email} not found`,
      );
    }
    return playerUpdated;
  }

  async deletePlayer(email: string): Promise<any> {
    const playersFound = await this.playerModel.findOne({ email }).exec();
    if (playersFound) {
      await this.playerModel.deleteOne({ email }).exec();
    } else {
      throw new NotFoundException(`No players found with email: ${email}`);
    }
  }
}
