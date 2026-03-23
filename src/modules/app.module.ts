import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from 'src/common/database';
import { timeout } from 'src/common/timeout';
import configuration from 'src/config/environment';
import { MultiThrottlerGuard } from 'src/guards/multi-throttler.guard';
import { HttpCacheInterceptor } from 'src/interceptors/HttpCache.interceptor';
import { HttpErrorFilter } from 'src/shared/httpError.filter';
import { TimeoutMiddleware } from 'src/shared/timeout.middleware';
import { TransformInterceptor } from 'src/shared/transform.interceptor';
import { LoggerModule } from '../common/logger';
import { AccountModule } from './account/account.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [configuration],
      isGlobal: true,
    }),
    CacheModule.register({
      ttl: timeout.halfAnHour,
      max: 100,
      isGlobal: true,
    }),
    ThrottlerModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    LoggerModule,
    AuthModule,
    AccountModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpErrorFilter,
    },
    {
      provide: APP_GUARD,
      useClass: MultiThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TimeoutMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
