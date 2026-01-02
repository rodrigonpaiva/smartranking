import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsUrl,
} from 'class-validator';
import {
  trim,
  trimLowercase,
} from '../../common/transformers/trim.transformer';

export class CreateClubDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  readonly name: string;

  @Transform(trimLowercase)
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MinLength(3)
  @MaxLength(64)
  readonly slug: string;

  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(80)
  readonly city?: string;

  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(80)
  readonly state?: string;

  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(500)
  readonly description?: string;

  @Transform(trim)
  @IsUrl()
  @IsOptional()
  readonly logoUrl?: string;
}
