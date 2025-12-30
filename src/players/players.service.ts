import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { Player } from './interfaces/players.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdatePlayerDto } from './dtos/update-player.dto';

@Injectable()
export class PlayersService {
  constructor(
    @InjectModel('Player') private readonly playerModel: Model<Player>,
  ) {}

  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const { email } = createPlayerDto;
    const playerExists = await this.playerModel.findOne({ email }).exec();
    if (playerExists) {
      throw new BadRequestException(
        `Player with email ${email} already exists`,
      );
    }
    const playerCreated = new this.playerModel(createPlayerDto);
    return await playerCreated.save();
  }
  async getAllPlayers(): Promise<Player[]> {
    return await this.playerModel.find().exec();
  }

  async updatePlayer(
    _id: string,
    updatePlayer: UpdatePlayerDto,
  ): Promise<void> {
    const playerExists = await this.playerModel.findById(_id).exec();
    if (!playerExists) {
      throw new NotFoundException(`Player with id ${_id} not found`);
    }
    await this.playerModel
      .findOneAndUpdate({ _id }, { $set: updatePlayer })
      .exec();
  }

  async getPlayerById(_id: string): Promise<Player> {
    const playerFound = await this.playerModel.findOne({ _id }).exec();
    if (!playerFound) {
      throw new NotFoundException(`No players found with id: ${_id}`);
    }
    return playerFound;
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

  async deletePlayer(_id: string): Promise<any> {
    const playersFound = await this.playerModel.findOne({ _id }).exec();
    if (playersFound) {
      await this.playerModel.deleteOne({ _id }).exec();
    } else {
      throw new NotFoundException(`No players found with id: ${_id}`);
    }
  }
}
