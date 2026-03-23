import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Nếu có lỗi từ strategy hoặc không có user
    if (err || !user) {
      // Kiểm tra các trường hợp lỗi cụ thể
      if (info) {
        const errorName = info.name;
        const errorMessage = info.message;

        // Token hết hạn
        if (errorName === 'TokenExpiredError') {
          throw new UnauthorizedException('Token has expired');
        }

        // Token không hợp lệ
        if (errorName === 'JsonWebTokenError') {
          throw new UnauthorizedException('Invalid token');
        }

        // Thiếu token
        if (errorMessage === 'No auth token') {
          throw new UnauthorizedException('No token provided');
        }
      }

      // Nếu có lỗi cụ thể từ validate (ví dụ: ForbiddenException)
      if (err) {
        throw err;
      }

      // Lỗi chưa xác định
      throw new UnauthorizedException('Authentication failed');
    }

    return user;
  }
}
