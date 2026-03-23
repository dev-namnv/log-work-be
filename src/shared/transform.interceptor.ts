import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Response<T> {
  statusCode: number;
  content: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<Response<T>>> {
    const ctx = context.switchToHttp();
    const { statusCode } = ctx.getResponse();
    const request = ctx.getRequest();

    // Lấy method và path từ request
    const { url } = request;

    // Kiểm tra xem route có nằm trong danh sách excluded hay không
    const isStremioRequested =
      url.startsWith('/stremio') || url.endsWith('.json');

    // Nếu route nằm trong danh sách excluded, bỏ qua interceptor
    if (isStremioRequested) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        return data;
      }),
    );
  }
}
