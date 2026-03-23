import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
} from 'class-validator';
import { NoticeToUsersDto } from './NoticeToUsers.dto';

export class NoticeToSomeUsersDto extends NoticeToUsersDto {
  @ApiProperty({ type: [String] })
  @ArrayMinSize(1)
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  ids: string[];

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsNotEmpty()
  sendWithMail: boolean;
}
