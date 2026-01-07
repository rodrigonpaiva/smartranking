import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryEventDto } from './cretae-categorie.dto';

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({ type: Boolean, default: false })
  @IsNotEmpty()
  @IsBoolean()
  isDoubles?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoryEventDto)
  events: Array<CategoryEventDto>;
}
