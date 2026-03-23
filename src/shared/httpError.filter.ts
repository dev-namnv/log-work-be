import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private logger = new Logger(HttpErrorFilter.name);
  constructor() {}

  private handleMessage(exception: HttpException | Error): void {
    let message: string;

    if (exception instanceof HttpException) {
      message = JSON.stringify(exception.getResponse());
    } else {
      message = JSON.stringify(exception.stack?.toString());
    }

    this.logger.error(message);
  }

  async catch(exception: HttpException, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    this.handleMessage(exception);
    const statusCode = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    let { message } = exception;
    let error: string = exception.message;

    if (exception.getResponse) {
      const eResponse = exception.getResponse() as {
        message: string[] | string;
        error: string;
      };
      message = Array.isArray(eResponse.message)
        ? eResponse.message[0]
        : eResponse.message;
      error = eResponse.error;
    }

    const errorResponse = {
      statusCode,
      content: {
        message: Array.isArray(message) ? message[0] : message,
        error: error || message,
      },
    };

    response.status(statusCode).json(errorResponse);
  }
}
