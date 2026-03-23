import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getRealClientIp } from 'src/common/ip.helper';

export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return getRealClientIp(request);
  },
);
