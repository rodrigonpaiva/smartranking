import { Logger } from '@nestjs/common';
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
import { AppModule } from './app.module';
import { auth } from './auth/auth';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { helmet } from './security/helmet';

type RequestWithUser = Request & { user?: { id?: string } | null };
type GetSessionFn = (payload: {
  headers: Request['headers'];
}) => Promise<{ user?: { id?: string } } | null>;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(new Logger('AppLogger'));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.requestId = req.headers['x-request-id']?.toString() ?? randomUUID();
    next();
  });
  app.use(helmet());
  app.enableCors({
    origin: [
      process.env.BETTER_AUTH_URL ?? 'http://localhost:8080',
      'http://localhost:5173',
    ],
    credentials: true,
  });

  const httpAdapter = app.getHttpAdapter().getInstance() as Application;
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
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = Number(process.env.PORT) || 8080;
  await app.listen(port);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application', error);
  process.exit(1);
});
