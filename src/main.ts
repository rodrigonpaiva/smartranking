import { NestFactory } from '@nestjs/core';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { auth } from './auth/auth';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  app.enableCors({
    origin: [process.env.BETTER_AUTH_URL ?? 'http://localhost:8080'],
    credentials: true,
  });
  const httpAdapter = app.getHttpAdapter().getInstance();
  const authHandler = toNodeHandler(auth);
  httpAdapter.all('/api/auth', authHandler);
  httpAdapter.all('/api/auth/{*path}', authHandler);
  httpAdapter.use(express.json());
  httpAdapter.use(express.urlencoded({ extended: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT || 8080);
}
bootstrap();
