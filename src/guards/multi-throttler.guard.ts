import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { timeout } from 'src/common/timeout';
import environment from 'src/config/environment';
import { SKIP_THROTTLE } from 'src/decorators/skipThrottle.decorator';

@Injectable()
export class MultiThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storage: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storage, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const isDevMode = environment().mode === 'dev';
    if (isDevMode) return true;
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE, [
      context.getHandler(),
      context.getClass(),
    ]);

    return skip === true;
  }

  protected options: ThrottlerModuleOptions = [
    {
      name: 'short',
      ttl: timeout.oneSecond,
      limit: 10,
    },
    {
      name: 'medium',
      ttl: timeout.oneSecond * 10,
      limit: 20,
    },
    {
      name: 'long',
      ttl: timeout.oneMinute,
      limit: 100,
    },
  ];
}
