import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  TENANCY_DEFAULT_TENANT,
  TENANCY_HEADER_NAME,
  TENANCY_QUERY_PARAMETER,
} from './tenancy.constants';
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
    const headerName = this.options.headerName ?? TENANCY_HEADER_NAME;
    const queryName =
      this.options.queryParameterName ?? TENANCY_QUERY_PARAMETER;
    const defaultTenant = this.options.defaultTenant ?? TENANCY_DEFAULT_TENANT;
    const allowMissingTenant = this.options.allowMissingTenant ?? false;

    const headerTenant =
      typeof req.headers[headerName] === 'string'
        ? req.headers[headerName]
        : undefined;
    const queryTenant =
      typeof req.query[queryName] === 'string'
        ? req.query[queryName]
        : undefined;
    const tenant = headerTenant ?? queryTenant ?? defaultTenant;

    if (
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
}
