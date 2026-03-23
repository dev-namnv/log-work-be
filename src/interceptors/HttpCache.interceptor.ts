import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';
import { SKIP_CACHE_KEY } from 'src/decorators/skip-cache.decorator';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CACHE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return undefined;

    const userId = request.user?._id;
    if (userId) {
      return `${userId}:${request.url}`;
    }

    return request.url;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const key = this.trackBy(context);

    // Nếu không cache request này
    if (!key || !this.isRequestCacheable(context)) {
      return next.handle();
    }

    const cacheManager = this.cacheManager;

    return cacheManager.get(key).then((cached) => {
      if (cached !== undefined && cached !== null) {
        // ✅ Có cache → trả luôn
        return of(cached);
      }

      // ✅ Không có cache → gọi handler
      return next.handle().pipe(
        tap(async (value) => {
          // ❗ Không được set cache khi value null/undefined
          if (value === undefined || value === null) return;

          try {
            await cacheManager.set(key, value);
          } catch (e) {
            console.warn('Cache SET failed:', e);
          }
        }),
      );
    });
  }

  protected allowedMethods: string[] = ['GET'];
}
