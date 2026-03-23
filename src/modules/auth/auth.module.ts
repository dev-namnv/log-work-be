import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import environment from 'src/config/environment';
import { JwtStrategy } from 'src/guards/strategies/jwt.strategy';
import { Account, AccountSchema } from 'src/schemas/account';
import { Notice, NoticeSchema } from 'src/schemas/notice';
import { MailModule } from '../mail/mail.module';
import { NoticeModule } from '../notice/notice.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    NoticeModule,
    MailModule,
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Notice.name, schema: NoticeSchema },
    ]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: async () => ({
        secret: environment().jwt.secret,
        signOptions: {
          expiresIn: environment().jwt.expiresIn,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
