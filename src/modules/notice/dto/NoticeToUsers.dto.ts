import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { NoticeType, NoticeVariant } from 'src/schemas/notice';

export class NoticeToUsersDto {
  @ApiProperty({ enum: NoticeType })
  @IsEnum(NoticeType)
  @IsNotEmpty()
  type: NoticeType;

  @ApiProperty({ enum: NoticeVariant })
  @IsEnum(NoticeVariant)
  @IsNotEmpty()
  variant: NoticeVariant;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;
}
