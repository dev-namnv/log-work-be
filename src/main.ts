import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import dns from 'dns';
import * as express from 'express';
import basicAuth from 'express-basic-auth';
import { join } from 'path';
import { getCORSWhiteList } from './config/cors';
import environment from './config/environment';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { AppModule } from './modules/app.module';
import { TelegramAdminService } from './modules/telegram/telegram-admin.service';

async function bootstrap(): Promise<void> {
  dns.setDefaultResultOrder('ipv4first');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Setup global exception filter
  const telegramAdmin = app.get(TelegramAdminService);
  app.useGlobalFilters(new GlobalExceptionFilter(telegramAdmin));

  app.use(cookieParser());
  app.use(
    ['/api-docs'],
    basicAuth({
      users: { admin: 'kutataxoa24h' },
      challenge: true,
    }),
  );
  const config = environment();
  const options = new DocumentBuilder()
    .setTitle('API Documents')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .setDescription('AIO Streaming APIs')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);

  app.enableCors({
    origin: getCORSWhiteList(config.mode),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Static files
  const staticAssetsPath = join(__dirname, '../client/build/assets');
  app.use('/', express.static(join(__dirname, '../client/build')));
  app.use('/assets', express.static(staticAssetsPath));

  // Protectors
  if (process.env.MODE !== 'dev') {
    app.use(['/api-docs'], (_, res) => {
      return res.status(403).json({ message: 'Forbidden' });
    });
  }

  // Middleware Express để strip trailing commas và nhiều dấu phẩy
  app.use((req, res, next) => {
    // chỉ xử lý path (không chạm query string)
    const [path, qs] = req.url.split('?');
    const normalizedPath = path.replace(/,+$/g, ''); // xóa dấu phẩy ở cuối
    if (normalizedPath !== path) {
      // sửa req.url và req.originalUrl để routing tiếp tục với đường đã chuẩn hoá
      req.url = normalizedPath + (qs ? `?${qs}` : '');
      req.originalUrl = req.url;
    }
    next();
  });

  await app.listen(config.port, '0.0.0.0');

  const appURL = await app.getUrl();

  Logger.log(`Server is running on: ${appURL}`, 'Bootstrap');
  Logger.log(`API docs: ${appURL}/api-docs/`, 'API Docs');

  // Setup Telegram bot
  try {
    const { TelegramBotService } = await import(
      './modules/telegram/telegram-bot.service'
    );
    const telegramBot = app.get(TelegramBotService);
    await telegramBot.setupBot();
  } catch (error: any) {
    Logger.error(
      `Failed to setup Telegram bot: ${error.message}`,
      'TelegramBot',
    );
  }
}
bootstrap();
