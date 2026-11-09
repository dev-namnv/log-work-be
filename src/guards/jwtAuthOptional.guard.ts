import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthOptionalGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Khớp với JwtStrategy: token lấy từ header "Authorization: Bearer ..."
    const hasBearerToken =
      request.headers?.authorization?.startsWith('Bearer ');

    // Không có token → cho qua với user = null
    if (!hasBearerToken) {
      return true;
    }

    // Có token → gọi strategy để validate
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
