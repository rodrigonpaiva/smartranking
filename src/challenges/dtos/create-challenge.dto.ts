import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
} from 'class-validator';

export class CreateChallengeDto {
  @IsNotEmpty()
  @IsDateString()
  DateHourChallenge: Date;

  @IsNotEmpty()
  @IsMongoId()
  requester: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsMongoId({ each: true })
  players: Array<string>;
}
