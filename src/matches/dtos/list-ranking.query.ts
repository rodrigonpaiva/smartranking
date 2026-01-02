import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';

export class ListRankingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Optional search over player name or email',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
