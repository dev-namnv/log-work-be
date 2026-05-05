import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Account } from './account';

export const GIT_INTEGRATION_COLLECTION = 'git_integrations';

export enum GitProvider {
  GitHub = 'GitHub',
  GitLab = 'GitLab',
}

@Schema({ timestamps: true, collection: GIT_INTEGRATION_COLLECTION })
export class GitIntegration extends Document {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Account.name, required: true })
  account: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(GitProvider) })
  provider: GitProvider;

  /** Numeric user ID from the provider */
  @Prop({ required: true })
  providerUserId: string;

  @Prop({ required: true })
  username: string;

  /** Display name from the provider profile */
  @Prop({ default: null })
  displayName: string;

  /** AES-256-GCM encrypted access token: "iv:authTag:ciphertext" (all hex) */
  @Prop({ required: true })
  accessToken: string;

  /** AES-256-GCM encrypted refresh token (if provided by provider) */
  @Prop({ default: null })
  refreshToken: string;

  /**
   * Per-integration HMAC secret.
   * User configures this as the webhook secret in their GitHub/GitLab repo settings.
   * GitHub: HMAC-SHA256 verified via X-Hub-Signature-256.
   * GitLab: matched via X-Gitlab-Token header.
   */
  @Prop({ required: true })
  webhookSecret: string;

  @Prop({ default: true })
  isActive: boolean;

  /** Timestamp of last successful poll — null means never polled */
  @Prop({ default: null })
  lastPolledAt: Date | null;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const GitIntegrationSchema =
  SchemaFactory.createForClass(GitIntegration);

GitIntegrationSchema.index({ account: 1 });
GitIntegrationSchema.index(
  { account: 1, provider: 1, providerUserId: 1 },
  { unique: true },
);
