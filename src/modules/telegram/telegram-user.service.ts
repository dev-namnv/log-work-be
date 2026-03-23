import { Injectable, Logger } from '@nestjs/common';
import environment from 'src/config/environment';
import {
  TelegramBaseService,
  TelegramMessageOptions,
} from './telegram-base.service';

@Injectable()
export class TelegramUserService {
  private readonly logger = new Logger(TelegramUserService.name);
  private readonly botToken: string;

  constructor(private readonly baseService: TelegramBaseService) {
    const config = environment().telegram;
    this.botToken = config.botForUserToken;
  }

  /**
   * Gửi tin nhắn đến user
   */
  async sendMessage(
    chatId: string,
    message: string,
    options?: TelegramMessageOptions,
  ): Promise<void> {
    await this.baseService.sendToRecipients(
      [chatId],
      message,
      this.botToken,
      options,
    );
  }

  /**
   * Gửi thông báo đến user
   */
  async sendNotice(chatId: string, title: string, text: string): Promise<void> {
    const message = this.baseService.formatNotice(title, text);
    await this.sendMessage(chatId, message, { parseMode: 'HTML' });
  }

  /**
   * Gửi tin nhắn có định dạng đến user
   */
  async sendFormattedMessage(
    chatId: string,
    data: {
      title: string;
      fields: Array<{ name: string; value: string }>;
      footer?: string;
    },
  ): Promise<void> {
    const message = this.baseService.formatFieldsMessage(data);
    await this.sendMessage(chatId, message, { parseMode: 'HTML' });
  }

  /**
   * Kiểm tra bot có được cấu hình hay không
   */
  isConfigured(): boolean {
    return Boolean(this.botToken);
  }
}
