import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const requestId =
      request.requestId ?? request.headers['x-request-id']?.toString();
    const userId = request.user?.id ?? null;
    const tenant = request.tenantId ?? null;
    const route = request.originalUrl ?? request.url;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log({
          event: 'http.request',
          requestId,
          tenant,
          userId,
          route,
          method: request.method,
          duration,
        });
      }),
    );
  }
}
