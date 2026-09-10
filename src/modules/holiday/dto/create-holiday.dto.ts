import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { HolidayType } from 'src/schemas/holiday';

export class CreateHolidayDto {
  @ApiProperty({ example: '2026-04-30', description: 'YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: 'Giỗ Tổ Hùng Vương' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: HolidayType, default: HolidayType.OFF })
  @IsEnum(HolidayType)
  @IsOptional()
  type?: HolidayType;
}
