import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum NoticeType {
  REGISTERED = 'Registered',
  APPLICATION = 'Application',
  ERROR = 'Error',
}

export enum NoticeVariant {
  DEFAULT = 'default',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

@Schema({ timestamps: true })
export class Notice extends Document {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  account: Types.ObjectId;

  @Prop({ enum: NoticeType, required: true })
  type: NoticeType;

  @Prop({ default: null })
  message: string;

  @Prop({ default: false })
  viewed: boolean;

  @Prop({ enum: NoticeVariant, default: NoticeVariant.DEFAULT })
  variant: NoticeVariant;

  @Prop({ default: null })
  link: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const NoticeSchema = SchemaFactory.createForClass(Notice);

NoticeSchema.index({ account: 1 });
NoticeSchema.index({ subtitle: 1 }, { sparse: true });
