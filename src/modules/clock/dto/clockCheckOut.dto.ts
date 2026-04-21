import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ClockCheckOutDto {
  @ApiProperty({ description: 'Organization ID to check out from' })
  @IsNotEmpty()
  @IsMongoId()
  organizationId: string;

  @ApiProperty({ required: false, description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}
