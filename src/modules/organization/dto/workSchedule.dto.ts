import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkScheduleDto {
  @ApiProperty({
    example: '08:00',
    description: 'Daily work start time in HH:mm (24-hour)',
  })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'workStartTime must be a valid HH:mm time (e.g. "08:00")',
  })
  workStartTime: string;

  @ApiProperty({
    example: '17:30',
    description: 'Daily work end time in HH:mm (24-hour)',
  })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'workEndTime must be a valid HH:mm time (e.g. "17:30")',
  })
  workEndTime: string;

  @ApiProperty({
    example: 60,
    description: 'Unpaid lunch break duration in minutes',
    minimum: 0,
    maximum: 240,
  })
  @IsInt()
  @Min(0)
  @Max(240)
  lunchBreakMinutes: number;
}

export class UpdateWorkScheduleDto {
  @ApiProperty({ type: WorkScheduleDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => WorkScheduleDto)
  workSchedule: WorkScheduleDto;
}

export class OptionalWorkScheduleDto {
  @ApiProperty({ type: WorkScheduleDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkScheduleDto)
  workSchedule?: WorkScheduleDto;
}
