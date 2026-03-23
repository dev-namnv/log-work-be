import { Types } from 'mongoose';
import { NoticeType, NoticeVariant } from 'src/schemas/notice';

export class NoticeCreateDto {
  type: NoticeType;
  variant: NoticeVariant;
  subtitle?: Types.ObjectId;
  message: string;
  emailMessage?: string;
}
