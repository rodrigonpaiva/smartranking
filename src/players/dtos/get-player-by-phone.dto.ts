import { IsNotEmpty, IsString } from 'class-validator';

export class GetPlayerByPhoneQueryDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}
