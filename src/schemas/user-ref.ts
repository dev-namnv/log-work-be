import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Account } from './account';
import { Organization } from './organization';

export const USER_REF_COLLECTION = 'user_refs';

/**
 * Stores lightweight per-user reference data that can be reused across
 * different features (e.g. last-used org, default settings, etc.).
 *
 * One document per user — upserted on demand.
 * Extend by adding new optional @Prop fields.
 */
@Schema({ timestamps: true, collection: USER_REF_COLLECTION })
export class UserRef extends Document {
  _id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: Account.name,
    required: true,
    unique: true,
  })
  account: Types.ObjectId;

  /** Most recently used organization when creating a WorkLog */
  @Prop({ type: Types.ObjectId, ref: Organization.name, default: null })
  lastWorkLogOrganization: Types.ObjectId | null;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const UserRefSchema = SchemaFactory.createForClass(UserRef);

UserRefSchema.index({ account: 1 }, { unique: true });
