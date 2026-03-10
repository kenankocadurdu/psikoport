import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SLOW_MS = 200;

@Injectable()
export class ResponseTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method?: string; url?: string }>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - start;
          if (elapsed > SLOW_MS && process.env.NODE_ENV === 'production') {
            this.logger.warn(
              `Slow response ${elapsed}ms ${req.method} ${req.url}`,
            );
          }
        },
      }),
    );
  }
}
