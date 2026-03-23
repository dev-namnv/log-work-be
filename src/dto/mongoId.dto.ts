import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class MongoIdDto {
  @ApiProperty({ type: String, description: 'ID' })
  @Matches(/^[a-fA-F0-9]{24}$/, {
    message: 'id must be a valid MongoDB ObjectId',
  })
  @IsNotEmpty()
  id: string;
}
