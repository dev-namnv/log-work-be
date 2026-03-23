import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateMetadataDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Metadata key is required' })
  key: string;

  @ApiProperty()
  @IsOptional()
  value: any;
}
