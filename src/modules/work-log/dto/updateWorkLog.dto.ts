import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateWorkLogDto {
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
