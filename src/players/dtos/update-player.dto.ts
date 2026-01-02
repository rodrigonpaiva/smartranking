import { Transform } from 'class-transformer';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { trim } from '../../common/transformers/trim.transformer';

export class UpdatePlayerDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[+0-9]{10,15}$/)
  readonly phone: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly name: string;
}
