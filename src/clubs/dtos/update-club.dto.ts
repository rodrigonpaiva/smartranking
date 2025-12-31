import { IsOptional, IsString } from 'class-validator';

export class UpdateClubDto {
  @IsString()
  @IsOptional()
  readonly name?: string;

  @IsString()
  @IsOptional()
  readonly slug?: string;

  @IsString()
  @IsOptional()
  readonly city?: string;

  @IsString()
  @IsOptional()
  readonly state?: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsString()
  @IsOptional()
  readonly logoUrl?: string;
}
