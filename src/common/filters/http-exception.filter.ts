import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StructuredLoggerService } from '../logger/logger.service';

type ErrorMessage = string | string[];

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = (
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR
    ) as HttpStatus;

    const errorPayload = this.buildErrorPayload(exception, status);
    this.logger.logException(exception, {
      statusCode: status,
      path: request.url,
      requestId: request.requestId ?? null,
    });

    response.status(status).json({
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.requestId ?? null,
      error: errorPayload,
    });
  }

  private buildErrorPayload(
    exception: unknown,
    status: HttpStatus,
  ): { statusCode: number; message: ErrorMessage } {
    if (exception instanceof HttpException) {
      return {
        statusCode: status,
        message: this.extractMessage(exception.getResponse()),
      };
    }

    if (exception instanceof Error) {
      return {
        statusCode: status,
        message:
          status === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'Internal server error'
            : exception.message,
      };
    }

    return {
      statusCode: status,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : 'Unexpected error',
    };
  }

  private extractMessage(response: unknown): ErrorMessage {
    if (!response) {
      return 'Unexpected error';
    }
    if (typeof response === 'string') {
      return response;
    }
    if (Array.isArray(response)) {
      return response.map((item) => this.stringifyMessage(item));
    }
    if (typeof response === 'object') {
      const body = response as { message?: unknown; error?: unknown };
      if (Array.isArray(body.message)) {
        return body.message.map((item) => this.stringifyMessage(item));
      }
      if (body.message) {
        return this.stringifyMessage(body.message);
      }
      if (body.error) {
        return this.stringifyMessage(body.error);
      }
    }
    return 'Unexpected error';
  }

  private stringifyMessage(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value === undefined || value === null) {
      return 'Unexpected error';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return 'Unexpected error';
      }
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return 'Unexpected error';
  }
}
