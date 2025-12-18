import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePlayerDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly phone: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly name: string;
}
