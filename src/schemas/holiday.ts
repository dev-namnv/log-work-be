import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum HolidayType {
  OFF = 'Off', // lễ / nghỉ bù → trừ khỏi ngày công
  WORKDAY = 'Workday', // T7/CN làm bù hoặc hoán đổi → cộng vào ngày công
}

@Schema({ timestamps: true })
export class Holiday extends Document {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true }) // YYYY-MM-DD
  date: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: HolidayType, default: HolidayType.OFF })
  type: HolidayType;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const HolidaySchema = SchemaFactory.createForClass(Holiday);

HolidaySchema.index({ date: 1 }, { unique: true });
