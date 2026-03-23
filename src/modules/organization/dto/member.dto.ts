import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class MemberDto {
  @ApiProperty({ description: 'Account ID of the member' })
  @IsNotEmpty()
  @IsMongoId()
  memberId: string;
}
