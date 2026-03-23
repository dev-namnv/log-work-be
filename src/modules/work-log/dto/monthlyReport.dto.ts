import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class MonthlyReportDto {
  @ApiProperty({ minimum: 1, maximum: 12, description: 'Month (1-12)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ minimum: 2000, description: 'Year (e.g. 2026)' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ required: false, description: 'Filter by organization ID' })
  @IsOptional()
  @IsMongoId()
  organizationId?: string;
}
