import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export class SyncGitDto {
  @ApiProperty({
    required: false,
    description: 'Sync commits from the last N days (1–90, default 7)',
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(90)
  subDays?: number = 7;
}
