import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';

export class ListMatchesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Restrict matches to a specific club (system admins only)',
  })
  @IsOptional()
  @IsMongoId()
  clubId?: string;

  @ApiPropertyOptional({ description: 'Restrict matches to a single category' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive ISO 8601 start date for playedAt (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive ISO 8601 end date for playedAt (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
