import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from 'src/schemas/account';
import { Notice, NoticeSchema } from 'src/schemas/notice';
import { AccountModule } from '../account/account.module';
import { MailModule } from '../mail/mail.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NoticeController } from './notice.controller';
import { NoticeGateway } from './notice.gateway';
import { NoticeService } from './notice.service';

@Module({
  imports: [
    MailModule,
    TelegramModule,
    forwardRef(() => AccountModule),
    MongooseModule.forFeature([
      { name: Notice.name, schema: NoticeSchema },
      { name: Account.name, schema: AccountSchema },
    ]),
  ],
  providers: [NoticeGateway, NoticeService],
  controllers: [NoticeController],
  exports: [NoticeGateway, NoticeService],
})
export class NoticeModule {}
