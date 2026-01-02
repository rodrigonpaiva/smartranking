import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class NoCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    this.applyNoCacheHeaders(response);
    return next.handle().pipe(
      tap(() => {
        this.applyNoCacheHeaders(response);
      }),
    );
  }

  private applyNoCacheHeaders(response: Response): void {
    response.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0',
    );
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.removeHeader('ETag');
    response.setHeader('ETag', randomUUID());
  }
}
