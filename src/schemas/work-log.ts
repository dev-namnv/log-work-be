import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Account } from './account';
import { Organization } from './organization';

export const WORK_LOG_COLLECTION = 'work_logs';

@Schema({ timestamps: true, collection: WORK_LOG_COLLECTION })
export class WorkLog extends Document {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Account.name, required: true })
  account: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organization: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  checkIn: Date;

  @Prop({ required: true })
  checkOut: Date;

  /** Computed and stored: differenceInMinutes(checkOut, checkIn) / 60 */
  @Prop({ required: true, min: 0 })
  hours: number;

  @Prop({ default: null })
  note: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const WorkLogSchema = SchemaFactory.createForClass(WorkLog);

WorkLogSchema.index({ account: 1, date: -1 });
WorkLogSchema.index({ organization: 1, date: -1 });
WorkLogSchema.index({ account: 1, organization: 1, date: 1 }, { unique: true });
