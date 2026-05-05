import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class UpdateUserRefDto {
  @ApiProperty({
    required: false,
    description: 'MongoDB ObjectId of the last used organization',
  })
  @IsOptional()
  @IsMongoId()
  lastWorkLogOrganization?: string;
}
