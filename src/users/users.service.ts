import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Roles } from '../auth/roles';
import { Club } from '../clubs/interfaces/club.interface';
import { Player } from '../players/interfaces/players.interface';
import { CreateUserProfileDto } from './dtos/create-user-profile.dto';
import { CreateSelfProfileDto } from './dtos/create-self-profile.dto';
import { UserProfile } from './interfaces/user-profile.interface';

@Injectable()
export class UserProfilesService {
  constructor(
    @InjectModel('UserProfile')
    private readonly userProfileModel: Model<UserProfile>,
    @InjectModel('Club') private readonly clubModel: Model<Club>,
    @InjectModel('Player') private readonly playerModel: Model<Player>,
  ) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return await this.userProfileModel.findOne({ userId }).exec();
  }

  async upsertProfile(dto: CreateUserProfileDto): Promise<UserProfile> {
    await this.validateProfile(dto);
    return await this.userProfileModel.findOneAndUpdate(
      { userId: dto.userId },
      { $set: dto },
      { upsert: true, new: true },
    );
  }

  async upsertSelfProfile(
    userId: string,
    dto: CreateSelfProfileDto,
  ): Promise<UserProfile> {
    await this.validateSelfProfile(dto);
    return await this.userProfileModel.findOneAndUpdate(
      { userId },
      { $set: { ...dto, userId } },
      { upsert: true, new: true },
    );
  }

  async getProfileOrFail(userId: string): Promise<UserProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }
    return profile;
  }

  async hasAnyProfile(): Promise<boolean> {
    const exists = await this.userProfileModel.exists({});
    return Boolean(exists);
  }

  private async validateProfile(dto: CreateUserProfileDto): Promise<void> {
    if (dto.role === Roles.SYSTEM_ADMIN) {
      return;
    }

    if (!dto.clubId) {
      throw new BadRequestException('clubId is required for this role');
    }

    const club = await this.clubModel.findById(dto.clubId).exec();
    if (!club) {
      throw new NotFoundException(`Club with id ${dto.clubId} not found`);
    }

    if (dto.role === Roles.PLAYER) {
      if (!dto.playerId) {
        throw new BadRequestException('playerId is required for player role');
      }
      const player = await this.playerModel.findById(dto.playerId).exec();
      if (!player) {
        throw new NotFoundException(`Player with id ${dto.playerId} not found`);
      }
      if (String(player.clubId) !== String(dto.clubId)) {
        throw new BadRequestException('Player does not belong to club');
      }
    }
  }

  private async validateSelfProfile(dto: CreateSelfProfileDto): Promise<void> {
    if (dto.role === Roles.SYSTEM_ADMIN) {
      throw new BadRequestException('system_admin is not allowed here');
    }

    const club = await this.clubModel.findById(dto.clubId).exec();
    if (!club) {
      throw new NotFoundException(`Club with id ${dto.clubId} not found`);
    }

    if (dto.playerId) {
      const player = await this.playerModel.findById(dto.playerId).exec();
      if (!player) {
        throw new NotFoundException(`Player with id ${dto.playerId} not found`);
      }
      if (String(player.clubId) !== String(dto.clubId)) {
        throw new BadRequestException('Player does not belong to club');
      }
    }
  }
}
