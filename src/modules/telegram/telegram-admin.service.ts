import { Injectable, Logger } from '@nestjs/common';
import environment from 'src/config/environment';
import { AccountService } from '../account/account.service';
import {
  TelegramBaseService,
  TelegramMessageOptions,
} from './telegram-base.service';

@Injectable()
export class TelegramAdminService {
  private readonly logger = new Logger(TelegramAdminService.name);
  private readonly botToken: string;

  constructor(
    private readonly baseService: TelegramBaseService,
    private readonly accountService: AccountService,
  ) {
    const config = environment().telegram;
    this.botToken = config.botToken;
  }

  /**
   * Lấy danh sách chat IDs của admin từ database
   */
  private async getAdminChatIds(): Promise<string[]> {
    try {
      const admins = await this.accountService.getAdmins();
      const chatIds = admins
        .map((admin) => admin.metadata?.telegramChatId)
        .filter((chatId): chatId is string => Boolean(chatId));
      return chatIds;
    } catch (error: any) {
      this.logger.error(`Failed to get admin chat IDs: ${error.message}`);
      return [];
    }
  }

  /**
   * Gửi tin nhắn đến admin
   */
  async sendMessage(
    message: string,
    options?: TelegramMessageOptions,
  ): Promise<void> {
    const adminChatIds = await this.getAdminChatIds();
    await this.baseService.sendToRecipients(
      adminChatIds,
      message,
      this.botToken,
      options,
    );
  }

  /**
   * Gửi cảnh báo
   */
  async sendAlert(title: string, details: string): Promise<void> {
    const message = this.baseService.formatAlert(title, details);
    await this.sendMessage(message, { parseMode: 'HTML' });
  }

  /**
   * Gửi thông báo
   */
  async sendNotice(title: string, text: string): Promise<void> {
    const message = this.baseService.formatNotice(title, text);
    await this.sendMessage(message, { parseMode: 'HTML' });
  }

  /**
   * Gửi thông báo lỗi
   */
  async sendError(error: Error, context?: string): Promise<void> {
    const message = this.baseService.formatError(error, context);
    await this.sendMessage(message, { parseMode: 'HTML' });
  }

  /**
   * Gửi tin nhắn có định dạng
   */
  async sendFormattedMessage(data: {
    title: string;
    fields: Array<{ name: string; value: string }>;
    footer?: string;
  }): Promise<void> {
    const message = this.baseService.formatFieldsMessage(data);
    await this.sendMessage(message, { parseMode: 'HTML' });
  }

  /**
   * Kiểm tra bot có được cấu hình hay không
   */
  async isConfigured(): Promise<boolean> {
    const adminChatIds = await this.getAdminChatIds();
    return Boolean(this.botToken && adminChatIds.length > 0);
  }
}
