import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';

export class ListCategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive filter on category label',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Restrict categories to a single club' })
  @IsOptional()
  @IsMongoId()
  clubId?: string;
}
