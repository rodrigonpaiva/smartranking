import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { StructuredLoggerService } from '../logger/logger.service';
import { RequestContextService } from '../logger/request-context.service';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly requestContext: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const startedAt = Date.now();
    const route = request.originalUrl ?? request.url;
    this.requestContext.merge({
      method: request.method,
      path: route,
    });

    return next.handle().pipe(
      tap(() => {
        this.logRequest(request, response.statusCode, startedAt);
      }),
      catchError((error) => {
        const status =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        this.logRequest(request, status, startedAt);
        const forwardedError =
          error instanceof Error ? error : new Error('Unknown request error');
        return throwError(() => forwardedError);
      }),
    );
  }

  private logRequest(
    request: Request,
    statusCode: number,
    startedAt: number,
  ): void {
    this.logger.logRequest({
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode,
      duration: Date.now() - startedAt,
    });
  }
}
