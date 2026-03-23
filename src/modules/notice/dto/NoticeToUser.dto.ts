import { IntersectionType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';
import { MongoIdDto } from 'src/dto/mongoId.dto';
import { NoticeToUsersDto } from './NoticeToUsers.dto';

export class NoticeToUserDto extends IntersectionType(
  NoticeToUsersDto,
  MongoIdDto,
) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsNotEmpty()
  sendWithMail: boolean;
}
