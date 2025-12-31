import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateClubDto } from './dtos/create-club.dto';
import { UpdateClubDto } from './dtos/update-club.dto';
import { Club } from './interfaces/club.interface';

@Injectable()
export class ClubsService {
  constructor(@InjectModel('Club') private readonly clubModel: Model<Club>) {}

  async createClub(createClubDto: CreateClubDto): Promise<Club> {
    const existingClub = await this.clubModel
      .findOne({ slug: createClubDto.slug })
      .exec();
    if (existingClub) {
      throw new BadRequestException(
        `Club with slug ${createClubDto.slug} already exists`,
      );
    }
    const clubCreated = new this.clubModel(createClubDto);
    (clubCreated as unknown as { tenant?: string }).tenant = String(
      clubCreated._id,
    );
    return await clubCreated.save();
  }

  async getAllClubs(): Promise<Club[]> {
    return await this.clubModel.find().exec();
  }

  async getPublicClubs(): Promise<Array<Pick<Club, '_id' | 'name'>>> {
    return await this.clubModel.find().select('_id name').exec();
  }

  async getClubById(_id: string): Promise<Club> {
    const clubFound = await this.clubModel.findOne({ _id }).exec();
    if (!clubFound) {
      throw new NotFoundException(`No clubs found with id: ${_id}`);
    }
    return clubFound;
  }

  async updateClub(_id: string, updateClub: UpdateClubDto): Promise<Club> {
    const clubExists = await this.clubModel.findById(_id).exec();
    if (!clubExists) {
      throw new NotFoundException(`Club with id ${_id} not found`);
    }
    const updated = await this.clubModel
      .findOneAndUpdate({ _id }, { $set: updateClub }, { new: true })
      .exec();
    return updated as Club;
  }

  async deleteClub(_id: string): Promise<void> {
    const clubFound = await this.clubModel.findOne({ _id }).exec();
    if (!clubFound) {
      throw new NotFoundException(`No clubs found with id: ${_id}`);
    }
    await this.clubModel.deleteOne({ _id }).exec();
  }
}
