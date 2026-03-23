import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import environment from 'src/config/environment';
import { AccountService } from '../account/account.service';
import { TelegramBaseService } from './telegram-base.service';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    message: any;
    data: string;
  };
}

export interface TelegramCommand {
  command: string;
  description: string;
  handler: (chatId: number, args: string[], userId: number) => Promise<void>;
}

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private appName = environment().appName;
  private readonly botToken: string;
  private readonly baseUrl: string;
  private commands = new Map<string, TelegramCommand>();
  private callbackHandler:
    | ((
        chatId: number,
        data: string,
        callbackQueryId: string,
        messageId: number,
      ) => Promise<void>)
    | null = null;
  private isPolling = false;
  private lastUpdateId = 0;

  constructor(
    private readonly baseService: TelegramBaseService,
    private accountService: AccountService,
  ) {
    const config = environment().telegram;
    this.botToken = config.botForUserToken;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.registerDefaultCommands();
  }

  /**
   * Initialize bot - gọi sau khi tất cả commands đã được đăng ký
   */
  async initialize(): Promise<void> {
    await this.setMyCommands();
    this.logger.log('Telegram bot initialized with commands menu');
  }

  /**
   * Setup bot dựa trên môi trường (dev: polling, production: webhook)
   */
  async setupBot(): Promise<void> {
    const config = environment();

    if (config.mode === 'dev') {
      // Development: use polling
      this.logger.log(
        'Setting up Telegram bot in development mode (polling)...',
      );

      // Xóa webhook trước khi start polling (nếu có)
      await this.deleteWebhook();

      await this.startPolling();
      this.logger.log('Telegram bot polling started');
    } else if (config.telegram.webhookUrl) {
      // Production: use webhook
      this.logger.log(
        'Setting up Telegram bot in production mode (webhook)...',
      );

      // Stop polling nếu đang chạy
      this.stopPolling();

      await this.setWebhook(config.telegram.webhookUrl);
      this.logger.log(`Telegram webhook set to: ${config.telegram.webhookUrl}`);
    } else {
      this.logger.warn(
        'Telegram bot not configured (no webhook URL in production)',
      );
    }
  }

  /**
   * Đăng ký command mới
   */
  registerCommand(
    command: string,
    description: string,
    handler: (chatId: number, args: string[], userId: number) => Promise<void>,
  ): void {
    this.commands.set(command, { command, description, handler });
    this.logger.log(`Registered command: /${command}`);
  }

  /**
   * Đăng ký callback handler
   */
  registerCallbackHandler(
    handler: (
      chatId: number,
      data: string,
      callbackQueryId: string,
      messageId: number,
    ) => Promise<void>,
  ): void {
    this.callbackHandler = handler;
    this.logger.log('Registered callback handler');
  }

  /**
   * Đồng bộ commands menu với Telegram
   */
  private async setMyCommands(): Promise<void> {
    try {
      const commandsList = Array.from(this.commands.values()).map((cmd) => ({
        command: cmd.command,
        description: cmd.description,
      }));

      await axios.post(`${this.baseUrl}/setMyCommands`, {
        commands: commandsList,
      });

      this.logger.log(`Set ${commandsList.length} commands to Telegram menu`);
    } catch (error: any) {
      this.logger.error(`Failed to set commands: ${error.message}`);
    }
  }

  /**
   * Đăng ký các commands mặc định
   */
  private registerDefaultCommands(): void {
    this.registerCommand('start', 'Start the bot', async (chatId) => {
      await this.sendMessage(
        chatId,
        `🎬 <b>Welcome to ${this.appName} Bot!</b>

Available commands:
/help - Show all commands
/getchatid - Get your chat ID to link with account
/status - Check your bot status

To receive notifications, copy your Chat ID and update it in your account settings.`,
        { parseMode: 'HTML' },
      );
    });

    this.registerCommand('help', 'Show help message', async (chatId) => {
      let helpText = '<b>📋 Available Commands:</b>\n';
      helpText += '━━━━━━━━━━━━━━━━\n\n';

      // General
      helpText += '<b>🏠 General</b>\n';
      helpText += '/start - Start the bot\n';
      helpText += '/help - Show help message\n';
      helpText += '/status - Check bot status\n';
      helpText += '/getchatid - Get your chat ID\n\n';

      // Account
      helpText += '<b>👤 Account</b>\n';
      helpText += '/account - Get account info\n';
      helpText += '/mysub - View subscription\n\n';

      await this.sendMessage(chatId, helpText.trim(), { parseMode: 'HTML' });
    });

    this.registerCommand(
      'getchatid',
      'Get your Telegram Chat ID',
      async (chatId, args, userId) => {
        await this.sendMessage(
          chatId,
          `🆔 <b>Your Telegram Info:</b>

<b>Chat ID:</b> <code>${chatId}</code>
<b>User ID:</b> <code>${userId}</code>

Copy your Chat ID and paste it in your account settings to receive notifications.`,
          { parseMode: 'HTML' },
        );
      },
    );

    this.registerCommand('status', 'Check bot status', async (chatId) => {
      const isConnected = await this.accountService.findOne({
        'metadata.telegramChatId': chatId.toString(),
      });
      await this.sendMessage(
        chatId,
        isConnected
          ? `✅ <b>Bot Status:</b> Active

You are connected to ${this.appName} notification system.`
          : `⚠️ <b>Bot Status:</b> Inactive

You are not connected to ${this.appName} notification system. Please <a href="${environment().webHost}/me/profile">link</a> your Chat ID in your account settings to receive notifications.`,
        { parseMode: 'HTML' },
      );
    });
  }

  /**
   * Xử lý update từ Telegram
   */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      if (update.message?.text) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error: any) {
      this.logger.error(`Error handling update: ${error.message}`);
    }
  }

  /**
   * Xử lý tin nhắn text
   */
  private async handleMessage(
    message: TelegramUpdate['message'],
  ): Promise<void> {
    if (!message?.text) return;

    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text.trim();

    // Parse command
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      const commandHandler = this.commands.get(command);
      if (commandHandler) {
        try {
          await commandHandler.handler(chatId, args, userId);
        } catch (error: any) {
          this.logger.error(
            `Error executing command /${command}: ${error.message}`,
          );
          await this.sendMessage(
            chatId,
            `❌ Error executing command: ${error.message}`,
          );
        }
      } else {
        await this.sendMessage(
          chatId,
          `❓ Unknown command. Type /help to see available commands.`,
        );
      }
    } else {
      // Handle non-command messages
      await this.sendMessage(
        chatId,
        `I received your message. Type /help to see available commands.`,
      );
    }
  }

  /**
   * Xử lý callback query (inline buttons)
   */
  private async handleCallbackQuery(
    callbackQuery: TelegramUpdate['callback_query'],
  ): Promise<void> {
    if (!callbackQuery) return;

    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    // Answer callback query để tắt loading
    await this.answerCallbackQuery(callbackQuery.id);

    // Gọi callback handler nếu đã đăng ký
    if (this.callbackHandler) {
      await this.callbackHandler(chatId, data, callbackQuery.id, messageId);
    } else {
      this.logger.log(`Callback query (no handler): ${data}`);
    }
  }

  /**
   * Gửi tin nhắn
   */
  async sendMessage(
    chatId: number,
    text: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      replyMarkup?: any;
      disableWebPagePreview?: boolean;
    },
  ): Promise<void> {
    try {
      const payload = {
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode,
        reply_markup: options?.replyMarkup,
        disable_web_page_preview: options?.disableWebPagePreview ?? true,
      };
      await axios.post(`${this.baseUrl}/sendMessage`, payload);
    } catch (error: any) {
      this.logger.error(`Error sending message: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(
          `Telegram API error: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }

  /**
   * Edit message
   */
  async editMessage(
    chatId: number,
    messageId: number,
    text: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      replyMarkup?: any;
    },
  ): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: options?.parseMode,
        reply_markup: options?.replyMarkup,
      });
    } catch (error: any) {
      this.logger.error(`Error editing message: ${error.message}`);
    }
  }

  /**
   * Answer callback query
   */
  private async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text,
      });
    } catch (error: any) {
      this.logger.error(`Error answering callback query: ${error.message}`);
    }
  }

  /**
   * Set webhook
   */
  async setWebhook(url: string): Promise<void> {
    try {
      const response = await axios.post(`${this.baseUrl}/setWebhook`, {
        url,
        allowed_updates: ['message', 'callback_query'],
      });
      this.logger.log(`Webhook set: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      this.logger.error(`Error setting webhook: ${error.message}`);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(): Promise<void> {
    try {
      const response = await axios.post(`${this.baseUrl}/deleteWebhook`);
      this.logger.log(`Webhook deleted: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      this.logger.error(`Error deleting webhook: ${error.message}`);
    }
  }

  /**
   * Get updates (polling)
   */
  async getUpdates(offset?: number): Promise<TelegramUpdate[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/getUpdates`, {
        offset,
        timeout: 30,
        allowed_updates: ['message', 'callback_query'],
      });
      return response.data.result || [];
    } catch (error: any) {
      this.logger.error(`Error getting updates: ${error.message}`);
      return [];
    }
  }

  /**
   * Start polling (for development)
   */
  async startPolling(): Promise<void> {
    if (this.isPolling) {
      this.logger.warn('Polling already started');
      return;
    }

    this.isPolling = true;
    this.logger.log('Starting Telegram bot polling...');

    while (this.isPolling) {
      try {
        const updates = await this.getUpdates(this.lastUpdateId + 1);
        for (const update of updates) {
          this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
          await this.handleUpdate(update);
        }
      } catch (error: any) {
        this.logger.error(`Polling error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    this.isPolling = false;
    this.logger.log('Stopping Telegram bot polling...');
  }

  /**
   * Get bot info
   */
  async getBotInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      return response.data.result;
    } catch (error: any) {
      this.logger.error(`Error getting bot info: ${error.message}`);
      return null;
    }
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/getWebhookInfo`);
      return response.data.result;
    } catch (error: any) {
      this.logger.error(`Error getting webhook info: ${error.message}`);
      return null;
    }
  }
}
