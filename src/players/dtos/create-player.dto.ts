import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsMongoId,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  trim,
  trimLowercase,
} from '../../common/transformers/trim.transformer';

export class CreatePlayerDto {
  @Transform(trimLowercase)
  @IsEmail()
  readonly email: string;

  @Transform(trim)
  @IsString()
  @Matches(/^[+0-9]{10,15}$/)
  readonly phone: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly name: string;

  @IsMongoId()
  readonly clubId: string;
}
