import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateShareLinkDto {
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

  @ApiProperty({
    required: false,
    description: 'Restrict shared report to a specific organization',
  })
  @IsOptional()
  @IsMongoId()
  organizationId?: string;

  @ApiProperty({
    required: false,
    description: 'Human-readable label, e.g. "Báo cáo tháng 3/2026"',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiProperty({
    required: false,
    description:
      'ISO date string — link expires after this date. Omit for no expiry.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
