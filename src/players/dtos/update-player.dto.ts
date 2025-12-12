import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdatePlayerDto {
  @IsEmail()
  readonly email: string;

  @IsString()
  @IsNotEmpty()
  readonly phone: string;

  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @IsString()
  readonly pictureUrl?: string;
}
