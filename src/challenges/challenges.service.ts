import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Challenge, Match } from './interfaces/challenge.interface';
import { Model, Types } from 'mongoose';
import { PlayersService } from '../players/players.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateChallengeDto } from './dtos/create-challenge.dto';
import { ChallengeStatus } from './interfaces/challenge-status.emun';
import { UpdateChallengeDto } from './dtos/update-challenge.dto';

@Injectable()
export class ChallengesService {
  constructor(
    @InjectModel('Challenge') private readonly challengeModel: Model<Challenge>,
    @InjectModel('Match') private readonly matchModel: Model<Match>,
    private readonly playerService: PlayersService,
    private readonly categoriesService: CategoriesService,
  ) {}

  private readonly logger = new Logger(ChallengesService.name);

  async createChallenge(
    createChallengeDto: CreateChallengeDto,
  ): Promise<Challenge> {
    const players = await Promise.all(
      createChallengeDto.players.map((playerId) =>
        this.playerService.getPlayerById(playerId),
      ),
    );

    const requesterId: string = this.toIdString(createChallengeDto.requester);

    const applicantOpponentInTheMatch = createChallengeDto.players.filter(
      (playerId) => this.toIdString(playerId) === requesterId,
    );

    this.logger.log(
      `applicantOpponentInTheMatch: ${JSON.stringify(applicantOpponentInTheMatch)}`,
    );

    if (applicantOpponentInTheMatch.length == 0) {
      this.logger.error(
        `The requester must be one of the players in the challenge: ${requesterId}`,
      );
      throw new BadRequestException(
        `The requester must be one of the players in the challenge: ${requesterId}`,
      );
    }

    const categoryPlayer =
      await this.categoriesService.getCategoryByPlayer(requesterId);

    if (!categoryPlayer) {
      this.logger.error(
        `The requester does not have a category assigned: ${requesterId}`,
      );
      throw new BadRequestException(
        `The requester does not have a category assigned: ${requesterId}`,
      );
    }

    const categoryPlayerIds = new Set(
      categoryPlayer.players.map((player) => this.toIdString(player)),
    );
    const playersOutsideCategory = players.filter(
      (player) => !categoryPlayerIds.has(this.toIdString(player._id)),
    );
    if (playersOutsideCategory.length > 0) {
      this.logger.error(
        `Players outside category ${categoryPlayer.category}: ${JSON.stringify(
          playersOutsideCategory.map((player) => player._id),
        )}`,
      );
      throw new BadRequestException(
        `All players must be in category ${categoryPlayer.category}`,
      );
    }

    const challenge = new this.challengeModel({
      DateHourChallenge: createChallengeDto.DateHourChallenge,
      status: ChallengeStatus.PENDING,
      DateHourReq: new Date(),
      Applicant: createChallengeDto.requester,
      category: categoryPlayer.category,
      players: players.map((player) => player._id),
    });

    return await challenge.save();
  }

  async updateChallenge(
    _id: string,
    updateChallengeDto: UpdateChallengeDto,
  ): Promise<Challenge> {
    const challenge = await this.challengeModel.findById(_id).exec();
    if (!challenge) {
      throw new NotFoundException(`Challenge with id ${_id} not found`);
    }

    const DateHourResp = updateChallengeDto.DateHourResp
      ? new Date(updateChallengeDto.DateHourResp)
      : new Date();

    await this.challengeModel
      .findOneAndUpdate(
        { _id },
        {
          $set: {
            status: updateChallengeDto.status,
            DateHourResp,
          },
        },
        { new: true },
      )
      .exec();

    const updatedChallenge: Challenge | null = await this.challengeModel
      .findById(_id)
      .exec();
    if (!updatedChallenge) {
      throw new NotFoundException(`Challenge with id ${_id} not found`);
    }
    return updatedChallenge;
  }

  async assignMatch(
    _id: string,
    def: string,
    result: Match['result'],
  ): Promise<Challenge> {
    const challenge = await this.challengeModel.findById(_id).exec();
    if (!challenge) {
      throw new NotFoundException(`Challenge with id ${_id} not found`);
    }

    const isPlayerInChallenge = challenge.players.some(
      (player) => this.toIdString(player) === def,
    );
    if (!isPlayerInChallenge) {
      throw new BadRequestException(
        `Winner ${def} is not part of this challenge`,
      );
    }

    const match = new this.matchModel({
      category: challenge.category,
      players: challenge.players,
      def,
      result,
    });

    const savedMatch = await match.save();

    try {
      await this.challengeModel
        .findOneAndUpdate(
          { _id },
          {
            $set: {
              status: ChallengeStatus.COMPLETED,
              DateHourResp: new Date(),
              match: savedMatch._id,
            },
          },
          { new: true },
        )
        .exec();
    } catch (error) {
      await this.matchModel.deleteOne({ _id: savedMatch._id }).exec();
      throw error;
    }

    const updatedChallenge = await this.challengeModel.findById(_id).exec();
    if (!updatedChallenge) {
      throw new NotFoundException(`Challenge with id ${_id} not found`);
    }

    return updatedChallenge;
  }

  async cancelChallenge(_id: string): Promise<Challenge> {
    const challenge = await this.challengeModel.findById(_id).exec();
    if (!challenge) {
      throw new NotFoundException(`Challenge with id ${_id} not found`);
    }

    await this.challengeModel
      .findOneAndUpdate(
        { _id },
        {
          $set: {
            status: ChallengeStatus.CANCELED,
            DateHourResp: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    const updatedChallenge = await this.challengeModel.findById(_id).exec();
    if (!updatedChallenge) {
      throw new NotFoundException(`Challenge with id ${_id} not found`);
    }

    return updatedChallenge;
  }

  private toIdString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeDoc = value as any;
    return maybeDoc?._id?.toString?.() ?? String(value);
  }
}
