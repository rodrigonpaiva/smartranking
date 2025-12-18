import { IsDateString, IsOptional } from 'class-validator';
import { ChallengeStatus } from '../interfaces/challenge-status.emun';

export class UpdateChallengeDto {
  @IsOptional()
  status: ChallengeStatus;

  @IsOptional()
  @IsDateString()
  DateHourResp: Date;
}
