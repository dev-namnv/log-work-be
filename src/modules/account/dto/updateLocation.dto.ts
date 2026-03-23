import { ApiProperty } from '@nestjs/swagger'
import { IsOptional } from 'class-validator'

export class UpdateLocationDto {
  @ApiProperty()
  @IsOptional()
  locale?: string

  @ApiProperty()
  @IsOptional()
  currency?: string
}
