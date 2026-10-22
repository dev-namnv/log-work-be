import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class HoursLogItemDto {
  @ApiProperty({
    required: false,
    example: '2026-03-23T08:00:00.000Z',
    description: 'Updated check-in datetime (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiProperty({
    required: false,
    example: '2026-03-23T17:30:00.000Z',
    description: 'Updated check-out datetime (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  checkOut?: string;
}

export class UpdateWorkLogDto {
  @ApiProperty({
    required: false,
    description: 'Updated check-in/out datetime (ISO 8601)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HoursLogItemDto)
  items: HoursLogItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    required: false,
    description:
      'Khi true, không trừ giờ nghỉ trưa đã cấu hình khi tính tổng giờ làm',
  })
  @IsOptional()
  @IsBoolean()
  skipLunchBreak?: boolean;
}
