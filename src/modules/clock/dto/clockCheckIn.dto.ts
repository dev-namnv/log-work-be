import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ClockCheckInDto {
  @ApiProperty({ description: 'Organization ID to check in for' })
  @IsNotEmpty()
  @IsMongoId()
  organizationId: string;

  @ApiProperty({ required: false, description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}
