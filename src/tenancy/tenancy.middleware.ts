import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { TENANCY_HEADER_NAME } from './tenancy.constants';
import { tenancyContext } from './tenancy.context';
import type { TenancyModuleOptions } from './tenancy.types';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor() {}

  private get options(): TenancyModuleOptions {
    return (this.constructor as typeof TenancyMiddleware).options;
  }

  static configure(options: TenancyModuleOptions): void {
    TenancyMiddleware.options = options;
  }

  private static options: TenancyModuleOptions = {};

  use(req: Request, res: Response, next: () => void): void {
    // Better Auth endpoints are tenantless.
    if (req.path?.startsWith('/api/auth')) {
      next();
      return;
    }

    // Tenantless endpoints (bootstrapping/public/health). These routes must work
    // before a tenant is selected and must not be scoped by the tenancy plugin.
    if (this.isTenantlessPath(req.path)) {
      req.tenantId = undefined;
      tenancyContext.run(
        {
          tenant: undefined,
          allowMissingTenant: true,
          disableTenancy: true,
        },
        next,
      );
      return;
    }

    const headerName = (
      this.options.headerName ?? TENANCY_HEADER_NAME
    ).toLowerCase();
    const allowMissingTenant = this.options.allowMissingTenant ?? false;

    const tenant = this.extractTenant(req, headerName);

    if (
      tenant &&
      this.options.allowTenant &&
      !this.options.allowTenant({ req }, tenant)
    ) {
      res.status(403).json({ message: 'Tenant not allowed' });
      return;
    }

    req.tenantId = tenant;

    tenancyContext.run(
      {
        tenant,
        allowMissingTenant,
        disableTenancy: false,
      },
      next,
    );
  }

  private extractTenant(req: Request, headerName: string): string | undefined {
    const headerValue = req.headers?.[headerName];
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }
    if (typeof headerValue === 'string') {
      return headerValue;
    }
    return undefined;
  }

  private isTenantlessPath(path?: string): boolean {
    if (!path) return false;
    if (path === '/health' || path === '/ready') return true;
    if (path === '/api/v1/users/me') return true;
    if (path === '/api/v1/clubs/public') return true;
    if (path === '/api/v1/clubs/register') return true;
    return false;
  }
}
