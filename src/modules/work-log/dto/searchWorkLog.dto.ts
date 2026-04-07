import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsMongoId,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { PaginationDto } from 'src/dto/pagination.dto';

export class SearchWorkLogDto extends PaginationDto {
  @ApiProperty({ description: 'Optional filter by organization ID' })
  @IsMongoId()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({
    description:
      'Optional filter by date (ISO 8601). Returns logs for that specific date.',
    example: '2026-03-23',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({
    description: 'Optional filter by month (1-12). Requires year to be set.',
    example: 3,
  })
  @Min(1)
  @Max(12)
  @IsNumber()
  @IsOptional()
  month?: number;

  @ApiProperty({
    description:
      'Optional filter by year (e.g. 2026). Required if month is set.',
    example: 2026,
  })
  @Min(2000)
  @IsNumber()
  @IsOptional()
  year?: number;
}
