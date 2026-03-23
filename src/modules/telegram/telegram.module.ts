import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { TelegramAdminService } from './telegram-admin.service';
import { TelegramBaseService } from './telegram-base.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramUserService } from './telegram-user.service';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [AccountModule],
  exports: [TelegramAdminService, TelegramUserService],
  providers: [
    TelegramBaseService,
    TelegramAdminService,
    TelegramUserService,
    TelegramBotService,
  ],
  controllers: [TelegramController],
})
export class TelegramModule {}
