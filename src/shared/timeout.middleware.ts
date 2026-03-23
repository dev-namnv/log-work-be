import {
  Injectable,
  NestMiddleware,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const twoMinutesInMs = 2 * 60 * 1000; // 2 phút

    const request$ = new Observable((observer) => {
      next();
      observer.next();
      observer.complete();
    }).pipe(
      timeout(twoMinutesInMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException('Request timed out');
        }
        return throwError(err);
      }),
    );

    request$.subscribe({
      error: (err) => {
        res.status(err.getStatus ? err.getStatus() : 500).send(err.message);
      },
    });
  }
}
