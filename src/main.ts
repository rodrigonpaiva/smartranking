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

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.BETTER_AUTH_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
  ].filter(Boolean) as string[];
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
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
