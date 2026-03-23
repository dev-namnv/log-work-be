import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const ORGANIZATION_COLLECTION = 'organizations';

/**
 * Embedded work-schedule configuration for an organization.
 * - workStartTime / workEndTime: 24-hour "HH:mm" strings (e.g. "08:00", "17:30")
 * - lunchBreakMinutes: duration of the unpaid lunch break in minutes (default 60)
 * standardHoursPerDay is derived:
 *   (workEndHour - workStartHour) - lunchBreakMinutes / 60
 */
export class WorkSchedule {
  /** Daily start time in HH:mm (24-hour), e.g. "08:00" */
  workStartTime: string;
  /** Daily end time in HH:mm (24-hour), e.g. "17:30" */
  workEndTime: string;
  /** Unpaid lunch break duration in minutes, e.g. 60 */
  lunchBreakMinutes: number;
}

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  workStartTime: '08:00',
  workEndTime: '17:30',
  lunchBreakMinutes: 60,
};

@Schema({ timestamps: true, collection: ORGANIZATION_COLLECTION })
export class Organization extends Document {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: null })
  description: string;

  @Prop({ default: null })
  avatar: string;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  owner: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Account' }], default: [] })
  members: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  /**
   * Work-schedule config. Defaults to 08:00–17:30 with 60-min lunch break.
   * Used to compute standardHoursPerDay and monthly salary metrics.
   */
  @Prop({ type: Object, default: () => ({ ...DEFAULT_WORK_SCHEDULE }) })
  workSchedule: WorkSchedule;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.index({ owner: 1 });
OrganizationSchema.index({ members: 1 });
