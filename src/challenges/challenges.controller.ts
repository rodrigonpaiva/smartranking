import {
  Body,
  Controller,
  Delete,
  Patch,
  Logger,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dtos/create-challenge.dto';
import { Challenge } from './interfaces/challenge.interface';
import { UpdateChallengeDto } from './dtos/update-challenge.dto';
import { ChallengeStatusValidationPipe } from './pipes/challenge-status-validation.pipe';
import { ValidationParamPipe } from '../common/pipes/validation-param.pipe';
import { AssingnChallengeMatchDto } from './dtos/assign-challenge-match.dtos';

@Controller('api/v1/challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}
  private readonly logger = new Logger(ChallengesController.name);

  @Post()
  @UsePipes(ValidationPipe)
  async createChallenge(
    @Body() createChallengeDto: CreateChallengeDto,
  ): Promise<Challenge> {
    this.logger.log(
      `createChallengeDto: ${JSON.stringify(createChallengeDto)}`,
    );
    return await this.challengesService.createChallenge(createChallengeDto);
  }

  @Patch('/:_id')
  @UsePipes(ValidationPipe, ChallengeStatusValidationPipe)
  async updateChallenge(
    @Param('_id', ValidationParamPipe) _id: string,
    @Body() updateChallengeDto: UpdateChallengeDto,
  ): Promise<Challenge> {
    return await this.challengesService.updateChallenge(
      _id,
      updateChallengeDto,
    );
  }

  @Post('/:_id/match')
  @UsePipes(ValidationPipe)
  async assignMatch(
    @Param('_id', ValidationParamPipe) _id: string,
    @Body() assignMatchDto: AssingnChallengeMatchDto,
  ): Promise<Challenge> {
    return await this.challengesService.assignMatch(
      _id,
      assignMatchDto.def,
      assignMatchDto.result,
    );
  }

  @Delete('/:_id')
  async cancelChallenge(
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<Challenge> {
    return await this.challengesService.cancelChallenge(_id);
  }
}
