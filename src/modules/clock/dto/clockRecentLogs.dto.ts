import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class ClockRecentLogsDto {
  @ApiProperty({
    required: false,
    description: 'Filter by organization ID',
  })
  @IsOptional()
  @IsMongoId()
  organizationId?: string;

  @ApiProperty({
    required: false,
    description: 'Number of recent logs to return (1–30, default 7)',
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(30)
  limit?: number = 7;
}
