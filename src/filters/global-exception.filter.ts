import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import environment from 'src/config/environment';
import { TelegramAdminService } from 'src/modules/telegram/telegram-admin.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private sentErrors = new Map<string, Date>();
  private ERROR_COOLDOWN = 5 * 60 * 1000; // 5 phút - không gửi lại error giống nhau

  constructor(private readonly telegramAdmin: TelegramAdminService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      exception instanceof HttpException
        ? typeof exceptionResponse === 'object' &&
          exceptionResponse !== null &&
          'message' in exceptionResponse
          ? (exceptionResponse as any).message
          : exception.message
        : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    // Log error (chỉ log chi tiết cho server errors)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : exception,
      );
    } else {
      // Client errors chỉ log warning
      const whitelist = ['/health', '/favicon.ico', '/auth/profile'];
      if (!whitelist.includes(request.url)) {
        this.logger.warn(
          `${request.method} ${request.url} - ${status} ${message}`,
        );
      }
    }

    // Gửi qua Telegram chỉ khi:
    // 1. Là server error (5xx)
    // 2. Không phải development mode
    // 3. Chưa gửi error tương tự gần đây (debounce)
    if (
      this.shouldSendErrorToTelegram(status, exception) &&
      environment().mode !== 'development'
    ) {
      await this.sendErrorToTelegram(exception, request);
    }

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Kiểm tra có nên gửi error qua Telegram không
   * Chỉ gửi server errors (5xx), bỏ qua client errors (4xx như 404, 401, 403...)
   */
  private shouldSendErrorToTelegram(
    status: number,
    exception: unknown,
  ): boolean {
    // Chỉ gửi server errors (500-599)
    if (status < 500) {
      return false;
    }

    // Check debounce
    const errorKey = this.getErrorKey(exception);
    const lastSent = this.sentErrors.get(errorKey);

    if (lastSent && Date.now() - lastSent.getTime() < this.ERROR_COOLDOWN) {
      return false; // Đã gửi error tương tự gần đây
    }

    return true;
  }

  /**
   * Tạo key unique cho error để debounce
   */
  private getErrorKey(exception: unknown): string {
    if (exception instanceof Error) {
      // Lấy first line của stack trace làm key
      const firstLine = exception.stack?.split('\n')[1]?.trim() || '';
      return `${exception.message}_${firstLine}`;
    }
    return String(exception);
  }

  /**
   * Gửi error qua Telegram
   */
  private async sendErrorToTelegram(
    exception: unknown,
    request: Request,
  ): Promise<void> {
    try {
      const errorKey = this.getErrorKey(exception);
      const error =
        exception instanceof Error ? exception : new Error(String(exception));

      const context = `
📍 Route: ${request.method} ${request.url}
🔑 IP: ${request.ip || request.socket.remoteAddress}
👤 User-Agent: ${request.headers['user-agent']?.substring(0, 100) || 'Unknown'}
⚙️ Environment: ${environment().mode}
      `.trim();

      await this.telegramAdmin.sendError(error, context);

      // Mark as sent
      this.sentErrors.set(errorKey, new Date());

      // Cleanup old entries (keep last 100)
      if (this.sentErrors.size > 100) {
        const firstKey = this.sentErrors.keys().next().value;
        this.sentErrors.delete(firstKey);
      }
    } catch (telegramError: any) {
      this.logger.error(
        `Failed to send error to Telegram: ${telegramError.message}`,
      );
    }
  }
}
