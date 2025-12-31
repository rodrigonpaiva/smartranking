import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class MatchScoreDto {
  @IsInt()
  @Min(0)
  readonly teamIndex: number;

  @IsInt()
  @Min(0)
  readonly score: number;
}

export class MatchSetDto {
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => MatchScoreDto)
  readonly games: MatchScoreDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MatchScoreDto)
  readonly tiebreak?: MatchScoreDto[];
}

export class MatchTeamDto {
  @ArrayMinSize(1)
  @IsString({ each: true })
  readonly players: string[];
}

export class CreateMatchDto {
  @IsString()
  @IsNotEmpty()
  readonly categoryId: string;

  @IsString()
  @IsNotEmpty()
  readonly clubId: string;

  @IsString()
  @IsIn(['SINGLES', 'DOUBLES'])
  readonly format: 'SINGLES' | 'DOUBLES';

  @IsInt()
  @Min(1)
  readonly bestOf: number;

  @IsOptional()
  @IsString()
  @IsIn(['STANDARD', 'ADVANTAGE', 'SUPER_TIEBREAK_7', 'SUPER_TIEBREAK_10'])
  readonly decidingSetType?:
    | 'STANDARD'
    | 'ADVANTAGE'
    | 'SUPER_TIEBREAK_7'
    | 'SUPER_TIEBREAK_10';

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MatchTeamDto)
  readonly teams: MatchTeamDto[];

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MatchSetDto)
  readonly sets: MatchSetDto[];

  @IsOptional()
  @IsDateString()
  readonly playedAt?: string;
}
