import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Account } from './account';
import { Organization } from './organization';

export const WORK_LOG_SHARE_COLLECTION = 'work_log_shares';

@Schema({ timestamps: true, collection: WORK_LOG_SHARE_COLLECTION })
export class WorkLogShare extends Document {
  _id: Types.ObjectId;

  /** Unique random token used in the public share URL */
  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ type: Types.ObjectId, ref: Account.name, required: true })
  account: Types.ObjectId;

  /** Optional: restrict the shared report to a specific organization */
  @Prop({ type: Types.ObjectId, ref: Organization.name, default: null })
  organization: Types.ObjectId | null;

  @Prop({ required: true, min: 1, max: 12 })
  month: number;

  @Prop({ required: true, min: 2000 })
  year: number;

  /** Human-readable label for the share link, e.g. "Báo cáo tháng 3/2026" */
  @Prop({ default: null })
  label: string | null;

  /** Optional expiry date — null means the link never expires */
  @Prop({ default: null })
  expiresAt: Date | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const WorkLogShareSchema = SchemaFactory.createForClass(WorkLogShare);

WorkLogShareSchema.index({ account: 1, createdAt: -1 });
WorkLogShareSchema.index({ token: 1 }, { unique: true });
