import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { randomUUID } from 'node:crypto';
import express, {
  type Application,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppModule } from './app.module';
import { auth } from './auth/auth';
import {
  persistOpenApiDocument,
  setupSwagger,
} from './common/swagger/swagger.config';
import { StructuredLoggerService } from './common/logger/logger.service';
import { RequestContextService } from './common/logger/request-context.service';
import pino from 'pino';

type RequestWithUser = Request & { user?: { id?: string } | null };
type GetSessionFn = (payload: {
  headers: Request['headers'];
}) => Promise<{ user?: { id?: string } } | null>;
type AuthLogRequest = Request & { _authEmail?: string | null };
type AuthLogResponse = Response & {
  write: Response['write'];
  end: Response['end'];
};
type JsonRecord = Record<string, unknown>;
type BufferEncoding = NodeJS.BufferEncoding;

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const asString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const parseJson = (payload: string): unknown => {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
};

const toBuffer = (chunk: unknown): Buffer | null => {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === 'string') return Buffer.from(chunk);
  return null;
};

const normalizeWriteArgs = (
  args: unknown[],
): { encoding?: BufferEncoding; callback?: (err?: Error) => void } => {
  const [encoding, callback] = args;
  return {
    encoding: isBufferEncoding(encoding) ? encoding : undefined,
    callback: isWriteCallback(callback) ? callback : undefined,
  };
};

const normalizeEndArgs = (
  args: unknown[],
): { encoding?: BufferEncoding; callback?: () => void } => {
  const [encoding, callback] = args;
  return {
    encoding: isBufferEncoding(encoding) ? encoding : undefined,
    callback: isEndCallback(callback) ? callback : undefined,
  };
};

const isWriteCallback = (value: unknown): value is (err?: Error) => void =>
  typeof value === 'function';

const isEndCallback = (value: unknown): value is () => void =>
  typeof value === 'function';

const isBufferEncoding = (value: unknown): value is BufferEncoding =>
  typeof value === 'string' && Buffer.isEncoding(value);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const appLogger = app.get(StructuredLoggerService);
  const requestContext = app.get(RequestContextService);
  app.useLogger(appLogger);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false },
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id']?.toString() ?? randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    const tenantHeader = req.headers['x-tenant-id'];
    const tenantId = Array.isArray(tenantHeader)
      ? tenantHeader[0]
      : (tenantHeader ?? null);
    requestContext.run(
      {
        requestId,
        method: req.method,
        path: req.originalUrl ?? req.url,
        startedAt: Date.now(),
        tenantId,
        userId: req.user?.id ?? null,
      },
      () => next(),
    );
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
    }),
  );

  const corsOptions: CorsOptions = {
    origin: 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-tenant-id', 'x-request-id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['x-request-id'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
  app.enableCors(corsOptions);

  const httpAdapter = app.getHttpAdapter().getInstance() as Application;
  const authRateLimiter = rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_TTL ?? '60') * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? '10'),
    standardHeaders: true,
    legacyHeaders: false,
  });
  httpAdapter.use('/api/auth', authRateLimiter);
  httpAdapter.use(/\/api\/auth(\/.*)?$/, authRateLimiter);
  httpAdapter.use(
    '/api/auth/sign-in/email',
    express.json({ type: 'application/json' }),
  );
  httpAdapter.use(
    '/api/auth/sign-in/email',
    (req: AuthLogRequest, res: AuthLogResponse, next: NextFunction) => {
      const body = (req as { body?: unknown }).body;
      const parsed =
        typeof body === 'string' ? parseJson(body) : (body ?? null);
      if (isRecord(parsed)) {
        const email = asString(parsed.email);
        req._authEmail = email ?? null;
      } else {
        req._authEmail = null;
      }

      const chunks: Buffer[] = [];
      const originalWrite = res.write.bind(res) as (
        chunk: Buffer | string,
        encoding?: BufferEncoding,
        callback?: (err?: Error) => void,
      ) => boolean;
      const originalEnd = res.end.bind(res) as (
        chunk?: Buffer | string,
        encoding?: BufferEncoding,
        callback?: () => void,
      ) => void;
      res.write = ((chunk, ...args) => {
        const buffer = toBuffer(chunk);
        if (buffer) {
          chunks.push(buffer);
        }
        if (Buffer.isBuffer(chunk) || typeof chunk === 'string') {
          const normalized = normalizeWriteArgs(args);
          return originalWrite(chunk, normalized.encoding, normalized.callback);
        }
        return originalWrite('', undefined, undefined);
      }) as Response['write'];
      res.end = ((chunk, ...args) => {
        const buffer = toBuffer(chunk);
        if (buffer) {
          chunks.push(buffer);
        }
        if (res.statusCode >= 400) {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          let reason = responseBody;
          const parsed = parseJson(responseBody);
          if (isRecord(parsed)) {
            const errorMessage = asString(parsed.error);
            const message = asString(parsed.message);
            reason = errorMessage ?? message ?? responseBody;
          }
          appLogger.warn('auth.signin.failed', {
            requestId: req.requestId,
            email: req._authEmail ?? null,
            tenantId: req.headers['x-tenant-id'] ?? null,
            statusCode: res.statusCode,
            reason,
          });
        }
        if (Buffer.isBuffer(chunk) || typeof chunk === 'string') {
          const normalized = normalizeEndArgs(args);
          return originalEnd(chunk, normalized.encoding, normalized.callback);
        }
        const normalized = normalizeEndArgs(args);
        return originalEnd(undefined, normalized.encoding, normalized.callback);
      }) as Response['end'];

      next();
    },
  );
  const authHandler: RequestHandler = toNodeHandler(auth);
  httpAdapter.all('/api/auth', authHandler);
  httpAdapter.all(/\/api\/auth(\/.*)?$/, authHandler);
  httpAdapter.use(async (req: Request, _res: Response, next: NextFunction) => {
    if (req.path?.startsWith('/api/auth')) {
      return next();
    }

    const requestWithUser = req as RequestWithUser;
    try {
      const getSession = auth.api?.getSession as GetSessionFn | undefined;
      if (getSession) {
        const session = await getSession({ headers: req.headers });
        requestWithUser.user = session?.user ?? null;
      } else {
        requestWithUser.user = null;
      }
    } catch {
      requestWithUser.user = null;
    }
    return next();
  });
  httpAdapter.use(express.json());
  httpAdapter.use(express.urlencoded({ extended: true }));
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const document = setupSwagger(app);
    persistOpenApiDocument(document);
  }
  const port = Number(process.env.PORT) || 8080;
  await app.listen(port);
}

bootstrap().catch((error) => {
  const fallbackLogger = pino({
    level: 'error',
    base: { source: 'bootstrap' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  fallbackLogger.error({ err: error }, 'Failed to bootstrap application');
  process.exit(1);
});
