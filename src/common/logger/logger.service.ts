import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger as PinoLogger } from 'pino';
import { RequestContextService } from './request-context.service';

interface LogPayload {
  [key: string]: unknown;
}

interface RequestLogPayload {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  contentLength?: number;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly logger: PinoLogger;

  constructor(private readonly requestContext: RequestContextService) {
    const level = process.env.LOG_LEVEL ?? this.resolveDefaultLevel();
    this.logger = pino({
      level,
      base: undefined,
      messageKey: 'message',
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  log(message: string, contextOrMeta?: string | LogPayload): void {
    this.write('info', message, this.normalizeMeta(contextOrMeta));
  }

  error(
    message: string,
    trace?: string,
    contextOrMeta?: string | LogPayload,
  ): void {
    const payload: LogPayload = {
      ...(this.normalizeMeta(contextOrMeta) ?? {}),
    };
    if (trace) {
      payload.trace = trace;
    }
    this.write('error', message, payload);
  }

  warn(message: string, contextOrMeta?: string | LogPayload): void {
    this.write('warn', message, this.normalizeMeta(contextOrMeta));
  }

  debug(message: string, contextOrMeta?: string | LogPayload): void {
    this.write('debug', message, this.normalizeMeta(contextOrMeta));
  }

  verbose(message: string, contextOrMeta?: string | LogPayload): void {
    this.write('trace', message, this.normalizeMeta(contextOrMeta));
  }

  logRequest(payload: RequestLogPayload): void {
    this.write('info', 'http.request', {
      ...payload,
      event: 'http.request',
    });
  }

  private normalizeMeta(
    contextOrMeta?: string | LogPayload,
  ): LogPayload | undefined {
    if (!contextOrMeta) {
      return undefined;
    }
    if (typeof contextOrMeta === 'string') {
      return { context: contextOrMeta };
    }
    return contextOrMeta;
  }

  logException(error: unknown, extra: LogPayload = {}): void {
    const serializedError = this.normalizeError(error);
    this.write('error', 'http.exception', {
      ...extra,
      event: 'http.exception',
      error: serializedError,
    });
  }

  private resolveDefaultLevel(): string {
    if (process.env.NODE_ENV === 'test') {
      return 'silent';
    }
    return 'info';
  }

  private normalizeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    if (!error) {
      return { message: 'Unknown error' };
    }
    if (typeof error === 'object') {
      return error as Record<string, unknown>;
    }
    if (typeof error === 'string') {
      return { message: error };
    }
    if (typeof error === 'number' || typeof error === 'boolean') {
      return { message: error.toString() };
    }
    return { message: 'Unknown error' };
  }

  private write(
    level: 'info' | 'error' | 'warn' | 'debug' | 'trace',
    message: string,
    extra?: LogPayload,
  ): void {
    const bindings = this.contextBindings(extra);
    this.logger[level](bindings, message);
  }

  private contextBindings(extra?: LogPayload): LogPayload {
    const store = this.requestContext.get();
    const bindings: LogPayload = {
      requestId: store?.requestId ?? null,
      tenantId: store?.tenantId ?? null,
      userId: store?.userId ?? null,
      role: store?.role ?? null,
      method: store?.method ?? null,
      path: store?.path ?? null,
      ...extra,
    };
    if (store?.clubId) {
      bindings.clubId = store.clubId;
    }
    if (store?.startedAt) {
      bindings.startedAt = store.startedAt;
    }
    return bindings;
  }
}
