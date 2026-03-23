import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthOptionalGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Check cả authorization cookie accessToken
    const hasAccessTokenCookie = !!request.cookies?.accessToken;

    // Nếu không có, cho phép tiếp tục với user = null
    if (!hasAccessTokenCookie) {
      return true;
    }

    // Có ít → gọi strategy để validate
    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  handleRequest(err: any, user: any) {
    // AuthOptional: không throw error, chỉ return null nếu invalid
    if (err || !user) {
      return null;
    }
    return user;
  }
}
