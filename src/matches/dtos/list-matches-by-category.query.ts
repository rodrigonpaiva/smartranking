import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';

export class ListMatchesByCategoryQueryDto extends PaginationQueryDto {
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
