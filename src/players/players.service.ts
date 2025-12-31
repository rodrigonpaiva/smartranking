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
import { Club } from '../clubs/interfaces/club.interface';

@Injectable()
export class PlayersService {
  constructor(
    @InjectModel('Player') private readonly playerModel: Model<Player>,
    @InjectModel('Club') private readonly clubModel: Model<Club>,
  ) {}

  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const { email, clubId } = createPlayerDto;
    const clubExists = await this.clubModel.findById(clubId).exec();
    if (!clubExists) {
      throw new NotFoundException(`Club with id ${clubId} not found`);
    }
    const playerExists = await this.playerModel
      .findOne({ email, clubId })
      .exec();
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

  async getPlayersByClubId(clubId: string): Promise<Player[]> {
    return await this.playerModel.find({ clubId }).exec();
  }

  async searchPlayers(query: string, clubId?: string): Promise<Player[]> {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const filter: Record<string, unknown> = {
      $or: [{ name: regex }, { email: regex }],
    };
    if (clubId) {
      filter.clubId = clubId;
    }
    return await this.playerModel
      .find(filter)
      .limit(20)
      .setOptions({ disableTenancy: true })
      .exec();
  }

  async updatePlayer(
    _id: string,
    updatePlayer: UpdatePlayerDto,
  ): Promise<Player> {
    const playerExists = await this.playerModel.findById(_id).exec();
    if (!playerExists) {
      throw new NotFoundException(`Player with id ${_id} not found`);
    }
    const updated = await this.playerModel
      .findOneAndUpdate({ _id }, { $set: updatePlayer }, { new: true })
      .exec();
    return updated as Player;
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
