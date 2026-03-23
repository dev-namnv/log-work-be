import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { NoticeType, NoticeVariant } from 'src/schemas/notice';

export class NoticeToAdminDto {
  @IsEnum(NoticeType)
  @IsNotEmpty()
  type: NoticeType;

  @IsEnum(NoticeVariant)
  @IsNotEmpty()
  variant: NoticeVariant;

  @IsString()
  @IsNotEmpty()
  message: string;
}
