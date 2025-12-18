import { IsMongoId, IsNotEmpty } from 'class-validator';
import { Result } from '../interfaces/challenge.interface';

export class AssingnChallengeMatchDto {
  @IsNotEmpty()
  @IsMongoId()
  def: string;

  @IsNotEmpty()
  result: Array<Result>;
}
