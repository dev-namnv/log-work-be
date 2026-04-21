import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateWorkLogDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsNotEmpty()
  @IsMongoId()
  organizationId: string;

  @ApiProperty({
    example: '2026-03-23T08:00:00.000Z',
    description: 'Check-in datetime (ISO 8601)',
  })
  @IsNotEmpty()
  @IsDateString()
  checkIn: string;

  @ApiProperty({
    example: '2026-03-23T17:30:00.000Z',
    description: 'Check-out datetime (ISO 8601), must be after checkIn',
  })
  @IsDateString()
  @IsOptional()
  checkOut?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'Khi true, không trừ giờ nghỉ trưa đã cấu hình khi tính tổng giờ làm',
  })
  @IsOptional()
  @IsBoolean()
  skipLunchBreak?: boolean;
}
