import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryEventDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['+', '-'])
  readonly operation: string;

  @IsNumber()
  readonly value: number;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  readonly category: string;

  @IsString()
  @IsNotEmpty()
  readonly description: string;

  @ApiProperty({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  readonly isDoubles?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoryEventDto)
  readonly events?: Array<CategoryEventDto>;

  @IsString()
  @IsNotEmpty()
  readonly clubId: string;
}
