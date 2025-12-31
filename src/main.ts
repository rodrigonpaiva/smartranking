import { NestFactory } from '@nestjs/core';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { auth } from './auth/auth';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  app.enableCors({
    origin: [
      process.env.BETTER_AUTH_URL ?? 'http://localhost:8080',
      'http://localhost:5173',
    ],
    credentials: true,
  });
  const httpAdapter = app.getHttpAdapter().getInstance();
  const authHandler = toNodeHandler(auth);
  httpAdapter.all('/api/auth', authHandler);
  httpAdapter.all('/api/auth/{*path}', authHandler);
  httpAdapter.use(async (req: Request, _res: Response, next: NextFunction) => {
    if (req.path?.startsWith('/api/auth')) {
      return next();
    }
    try {
      const getSession = auth.api?.getSession as
        | ((payload: {
            headers: Record<string, unknown>;
          }) => Promise<{ user?: { id?: string } } | null>)
        | undefined;
      if (getSession) {
        const session = await getSession({ headers: req.headers });
        (req as Request & { user?: { id?: string } | null }).user =
          session?.user ?? null;
      } else {
        (req as Request & { user?: { id?: string } | null }).user = null;
      }
    } catch {
      (req as Request & { user?: { id?: string } | null }).user = null;
    }
    return next();
  });
  httpAdapter.use(express.json());
  httpAdapter.use(express.urlencoded({ extended: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT || 8080);
}
bootstrap();
