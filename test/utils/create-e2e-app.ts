import type {
  INestApplication,
  ExecutionContext,
  CallHandler,
  NestInterceptor,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import request, { type SuperTest, type Test as SupertestTest } from 'supertest';
import { Observable } from 'rxjs';

import { AppModule } from '../../src/app.module';
import { TenancyService } from '../../src/tenancy/tenancy.service';
import { tenancyContext } from '../../src/tenancy/tenancy.context';
import { RequestContextService } from '../../src/common/logger/request-context.service';
import { randomUUID } from 'node:crypto';

type RequestWithContext = Request & {
  requestId?: string;
  user?: { id?: string; email?: string } | null;
  tenantId?: string | null;
  accessContext?: {
    userId: string;
    role: string;
    tenantId: string | null;
    clubId?: string;
    playerId?: string;
  } | null;
  userProfile?: {
    userId: string;
    role: string;
    clubId?: string;
    playerId?: string;
  } | null;
};

const headerValue = (req: Request, name: string): string | undefined => {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
};

const getE2ETenant = (): string =>
  (process.env.E2E_TENANT_ID ?? 'e2e-tenant').trim() || 'e2e-tenant';

const getE2ERole = (): string =>
  (process.env.E2E_ROLE ?? 'system_admin').trim() || 'system_admin';

// Note: in e2e, we bypass Better Auth by injecting a stable req.user + profile.
// Additionally, we make tenancy AsyncLocalStorage propagation explicit via a
// global interceptor (Nest/RxJS can otherwise lose the ALS store in tests).

export const expectE2e = (
  test: SupertestTest,
  expectedStatus: number,
  label?: string,
): SupertestTest => {
  return test
    .expect((res) => {
      if (res.status >= 500) {
        // Minimal debug info: status + response body/text.
        const payload = {
          label: label ?? 'e2e',
          status: res.status,
          body: res.body,
          text: res.text,
        };

        console.error('[E2E 5xx]', JSON.stringify(payload, null, 2));
      }
    })
    .expect(expectedStatus);
};

export type E2EApp = {
  moduleRef: TestingModule;
  app: INestApplication;
  httpServer: unknown;
  close: () => Promise<void>;
};

@Injectable()
class E2ETenancyInterceptor implements NestInterceptor {
  constructor(private readonly tenancyService: TenancyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const tenantId =
      headerValue(request, 'x-tenant-id') ?? request.tenantId ?? getE2ETenant();

    return new Observable((subscriber) => {
      tenancyContext.run(
        { tenant: tenantId, allowMissingTenant: false, disableTenancy: false },
        () => {
          // Ensure TenancyService sees the same scope.
          this.tenancyService.setTenant(tenantId);

          const sub = next.handle().subscribe({
            next: (v) => subscriber.next(v),
            error: (e) => subscriber.error(e),
            complete: () => subscriber.complete(),
          });

          return () => sub.unsubscribe();
        },
      );
    });
  }
}

export const createE2EApp = async (
  nestOptions: NestApplicationOptions = {},
): Promise<E2EApp> => {
  // Ensure e2e runs with visible logs when failures happen.
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'debug';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication(nestOptions);

  const tenancyService = moduleRef.get(TenancyService);
  const requestContext = moduleRef.get(RequestContextService);

  // If a spec asks for bodyParser: false, we still need JSON parsing for
  // non-auth routes in e2e.
  if ((nestOptions as { bodyParser?: boolean }).bodyParser === false) {
    const httpAdapter = app
      .getHttpAdapter()
      .getInstance() as express.Application;
    httpAdapter.use(express.json());
    httpAdapter.use(express.urlencoded({ extended: true }));
  }

  // Recreate main.ts request id behavior for tests.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const request = req as RequestWithContext;
    const requestId = headerValue(request, 'x-request-id') ?? randomUUID();
    request.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    // Run request-context ALS store so logs/error envelopes have a requestId.
    requestContext.run(
      {
        requestId,
        method: request.method,
        path: request.originalUrl ?? request.url,
        startedAt: Date.now(),
        tenantId: headerValue(request, 'x-tenant-id') ?? null,
        userId: request.user?.id ?? null,
      },
      () => next(),
    );
  });

  // Establish tenancy ALS at the express level (mirrors TenancyMiddleware).
  // This is required because mongoose hooks (tenancyPlugin) depend on tenancyContext.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const tenant = headerValue(req, 'x-tenant-id');
    tenancyContext.run(
      { tenant, allowMissingTenant: false, disableTenancy: false },
      () => next(),
    );
  });

  // In e2e we bypass Better Auth by injecting a stable req.user + profile.
  // IMPORTANT: only do this when the test explicitly provides x-test-user
  // (so security tests can still assert 401 when session is missing).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const request = req as RequestWithContext;

    // Do not auto-inject x-tenant-id (some security tests assert missing header).
    const tenantHeader = headerValue(request, 'x-tenant-id');
    request.tenantId = tenantHeader ?? request.tenantId ?? getE2ETenant();

    const userIdFromHeaders = headerValue(request, 'x-test-user');
    if (!userIdFromHeaders) {
      next();
      return;
    }

    // Always inject an authenticated user when x-test-user is present.
    request.user = {
      id: userIdFromHeaders,
      email: 'e2e@local.test',
    };

    // Only inject profile/roles when x-test-role is present.
    // This allows bootstrap tests to simulate "authenticated but no profile".
    const roleFromHeaders = headerValue(request, 'x-test-role');
    if (!roleFromHeaders) {
      next();
      return;
    }

    const role = roleFromHeaders as unknown as
      | 'system_admin'
      | 'club'
      | 'player';
    const clubId = headerValue(request, 'x-test-club') ?? undefined;
    const playerId = headerValue(request, 'x-test-player') ?? undefined;

    request.userProfile = {
      userId: request.user.id ?? 'e2e-user',
      role,
      clubId,
      playerId,
    } as any;

    request.accessContext = {
      userId: request.user.id ?? 'e2e-user',
      role,
      tenantId: request.tenantId ?? null,
      clubId,
      playerId,
    };

    next();
  });

  // Enable CORS in e2e similarly to main.ts (tests may assert headers).
  const parseAllowedOrigins = (
    envValue?: string,
  ): string | string[] | boolean => {
    if (!envValue) {
      return process.env.NODE_ENV === 'production'
        ? false
        : 'http://localhost:5173';
    }
    const origins = envValue
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    return origins.length === 1 ? origins[0] : origins;
  };
  app.enableCors({
    origin: parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-tenant-id', 'x-request-id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['x-request-id'],
  });

  // Minimal stub for Better Auth routes in tests (main.ts bootstrap does this).
  // NOTE: needs to be registered AFTER enableCors so CORS headers apply.
  const httpAdapter = app.getHttpAdapter().getInstance() as express.Application;
  httpAdapter.all('/api/auth', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  httpAdapter.all(/\/api\/auth(\/.*)?$/, (_req, res) =>
    res.status(200).json({ ok: true }),
  );

  // Force tenancy ALS propagation during controller/service execution.
  app.useGlobalInterceptors(new E2ETenancyInterceptor(tenancyService));

  await app.init();

  return {
    moduleRef,
    app,
    httpServer: app.getHttpServer(),
    close: async () => {
      await app.close();
    },
  };
};

const withE2eDebug = (test: SupertestTest, label: string): SupertestTest =>
  test.expect((res) => {
    if (res.status >= 500) {
      const payload = {
        label,
        status: res.status,
        body: res.body,
        text: res.text,
      };

      console.error('[E2E 5xx]', JSON.stringify(payload, null, 2));
    }
  });

export const e2e = (httpServer: unknown, label = 'e2e') => {
  const agent = request(httpServer as never);
  return {
    get: (url: string) => withE2eDebug(agent.get(url), label),
    post: (url: string) => withE2eDebug(agent.post(url), label),
    put: (url: string) => withE2eDebug(agent.put(url), label),
    patch: (url: string) => withE2eDebug(agent.patch(url), label),
    delete: (url: string) => withE2eDebug(agent.delete(url), label),
  };
};
