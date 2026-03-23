import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { TimeUtil } from 'src/utils/time.util';

export interface TelegramMessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  timezone?: string; // Timezone của user (ví dụ: 'Asia/Ho_Chi_Minh', 'UTC+7')
}

@Injectable()
export class TelegramBaseService {
  protected readonly logger = new Logger(TelegramBaseService.name);

  // Debounce mechanism để tránh spam messages
  private messageCache = new Map<
    string,
    { timestamp: number; messageHash: string }
  >();
  private readonly DEBOUNCE_TIME = 60000; // 1 phút - không gửi lại message giống nhau trong 1 phút

  /**
   * Tạo hash của message để so sánh
   */
  private hashMessage(chatId: string, message: string): string {
    return `${chatId}:${message.substring(0, 100)}`; // Lấy 100 ký tự đầu làm hash
  }

  /**
   * Kiểm tra xem message có nên được gửi không (debounce check)
   */
  private shouldSendMessage(chatId: string, message: string): boolean {
    const messageHash = this.hashMessage(chatId, message);
    const cached = this.messageCache.get(messageHash);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.DEBOUNCE_TIME) {
      this.logger.debug(`Skipping duplicate message to ${chatId} (debounced)`);
      return false;
    }

    // Cập nhật cache
    this.messageCache.set(messageHash, { timestamp: now, messageHash });

    // Dọn dẹp cache cũ (messages quá 5 phút)
    for (const [key, value] of this.messageCache.entries()) {
      if (now - value.timestamp > 5 * 60 * 1000) {
        this.messageCache.delete(key);
      }
    }

    return true;
  }

  /**
   * Gửi tin nhắn đến một hoặc nhiều chat IDs với bot token cụ thể
   */
  async sendToRecipients(
    chatIds: string[],
    message: string,
    botToken: string,
    options?: TelegramMessageOptions,
  ): Promise<void> {
    if (!botToken || chatIds.length === 0) {
      this.logger.warn('Telegram bot not configured. Skipping message.');
      return;
    }

    const baseUrl = `https://api.telegram.org/bot${botToken}`;
    const promises = chatIds.map((chatId) =>
      this.sendMessageToChat(baseUrl, chatId, message, options),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Gửi tin nhắn đến một chat ID cụ thể
   */
  async sendMessageToChat(
    baseUrl: string,
    chatId: string,
    text: string,
    options?: TelegramMessageOptions,
  ): Promise<void> {
    // Kiểm tra debounce trước khi gửi
    if (!this.shouldSendMessage(chatId, text)) {
      return;
    }

    try {
      const response = await axios.post(`${baseUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode,
        disable_web_page_preview: options?.disableWebPagePreview ?? true,
        disable_notification: options?.disableNotification ?? false,
      });

      if (!response.data.ok) {
        this.logger.error(
          `Failed to send Telegram message: ${response.data.description}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Error sending Telegram message to ${chatId}: ${error.message}`,
      );
    }
  }

  /**
   * Format alert message
   */
  formatAlert(title: string, details: string, date?: Date): string {
    return `
🚨 <b>ALERT: ${this.escapeHtml(title)}</b>

${this.escapeHtml(details)}

⏰ Time: ${TimeUtil.formatInTimeZone(date)}`.trim();
  }

  /**
   * Format notice message
   */
  formatNotice(title: string, message: string, date?: Date): string {
    return `
📢 <b>${this.escapeHtml(title)}</b>

${this.escapeHtml(message)}

⏰ ${TimeUtil.formatInTimeZone(date)}`.trim();
  }

  /**
   * Format error message
   */
  formatError(error: Error, context?: string, date?: Date): string {
    return `
❌ <b>ERROR${context ? `: ${this.escapeHtml(context)}` : ''}</b>

<b>Message:</b> ${this.escapeHtml(error.message)}

<b>Stack:</b>
<pre>${this.escapeHtml(error.stack?.substring(0, 500) || 'No stack trace')}</pre>

⏰ ${TimeUtil.formatInTimeZone(date)}
    `.trim();
  }

  /**
   * Format fields message
   */
  formatFieldsMessage(data: {
    title: string;
    fields: Array<{ name: string; value: string }>;
    footer?: string;
  }): string {
    let message = `<b>${this.escapeHtml(data.title)}</b>\n\n`;

    for (const field of data.fields) {
      message += `<b>${this.escapeHtml(field.name)}:</b> ${this.escapeHtml(field.value)}\n`;
    }

    if (data.footer) {
      message += `\n<i>${this.escapeHtml(data.footer)}</i>`;
    }

    return message;
  }

  /**
   * Escape HTML để tránh lỗi khi parse
   */
  escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
