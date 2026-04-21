import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum QrSessionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
}

@Schema({ timestamps: true, collection: 'qr_sessions' })
export class QrSession extends Document {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({ enum: QrSessionStatus, default: QrSessionStatus.PENDING })
  status: QrSessionStatus;

  @Prop({ type: Types.ObjectId, ref: 'Account', default: null })
  account: Types.ObjectId;

  @Prop({ default: null })
  token: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const QrSessionSchema = SchemaFactory.createForClass(QrSession);

QrSessionSchema.index({ sessionId: 1 }, { unique: true });
QrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
