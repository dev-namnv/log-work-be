import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { Exclude } from 'class-transformer';
import { Document, Types } from 'mongoose';
import { AccountMetadata, AccountRole } from 'src/interfaces/Account';

export const ACCOUNT_COLLECTION = 'accounts';

export const ACCOUNT_FIELD_SELECTS = [
  '_id',
  'firstName',
  'lastName',
  'phone',
  'avatar',
  'role',
  'email',
  'languages',
  'metadata',
  'credits',
  'isVerified',
  'createdAt',
  'updatedAt',
];

@Schema({ timestamps: true, collection: ACCOUNT_COLLECTION })
export class Account extends Document {
  _id: Types.ObjectId;

  @Prop({ default: null })
  @ApiProperty({ description: 'Google ID' })
  googleId: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  @ApiProperty({ description: 'Email' })
  email: string;

  @Prop()
  @Exclude({ toPlainOnly: true })
  password: string;

  @Prop({ default: null })
  @ApiProperty({ description: 'Phone' })
  phone: string;

  @Prop()
  @ApiProperty({ description: 'First name' })
  firstName: string;

  @Prop()
  @ApiProperty({ description: 'Last name' })
  lastName: string;

  @Prop({ default: null })
  @ApiProperty({ description: 'Avatar', default: null })
  avatar: string;

  @Prop({ default: false })
  @ApiProperty({ default: false })
  isVerified: boolean;

  @Prop({ enum: AccountRole, default: AccountRole.USER })
  @ApiProperty({ enum: AccountRole })
  role: AccountRole;

  @Prop({ default: ['english'] })
  @ApiProperty({ type: [String] })
  languages: string[];

  @Prop({ default: 0 })
  @ApiProperty({
    description: 'Free credits per month (For download/translate)',
    default: 10,
  })
  credits: number;

  @Prop({ default: true })
  isActivated: boolean;

  @Prop({ default: [] })
  ips: string[];

  @Prop({ default: null })
  lastLoginIp: string;

  @Prop({ type: Object, default: {} })
  metadata: AccountMetadata;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);

AccountSchema.pre<Account>(/(save|update)/i, function (next) {
  if (!this.password || !this.isModified('password')) {
    return next();
  }

  bcrypt.genSalt(10, (genSaltError, salt) => {
    if (genSaltError) {
      return next(genSaltError);
    }

    bcrypt.hash(this.password, salt, (err, hash) => {
      if (err) {
        return next(err);
      }
      this.password = hash;
      next();
    });
  });
});

AccountSchema.methods.toJSON = function (): Document<Account> {
  return this.toObject();
};

AccountSchema.index({ email: 'text', firstName: 'text', lastName: 'text' });
