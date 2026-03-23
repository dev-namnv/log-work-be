import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { TelegramBotService, TelegramUpdate } from './telegram-bot.service';

@Controller('telegram')
@ApiTags('Telegram')
export class TelegramController {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  /**
   * Webhook endpoint để nhận updates từ Telegram
   */
  @Post('webhook')
  @SkipThrottle()
  @ApiOperation({ summary: 'Telegram webhook endpoint' })
  async webhook(@Body() update: TelegramUpdate) {
    await this.telegramBotService.handleUpdate(update);
    return { ok: true };
  }

  /**
   * Get bot info
   */
  @Get('bot-info')
  @ApiOperation({ summary: 'Get Telegram bot info' })
  async getBotInfo() {
    return this.telegramBotService.getBotInfo();
  }

  /**
   * Get webhook info
   */
  @Get('webhook-info')
  @ApiOperation({ summary: 'Get Telegram webhook info' })
  async getWebhookInfo() {
    return this.telegramBotService.getWebhookInfo();
  }
}
