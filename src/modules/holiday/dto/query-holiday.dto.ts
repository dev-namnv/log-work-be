import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class QueryHolidayDto {
  @ApiPropertyOptional({ example: '2026', description: 'Filter by year' })
  @Matches(/^\d{4}$/, { message: 'year must be YYYY' })
  @IsOptional()
  year?: string;
}
