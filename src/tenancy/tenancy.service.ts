import { Injectable } from '@nestjs/common';
import { tenancyContext } from './tenancy.context';
import { TenancyScope } from './tenancy.types';

@Injectable()
export class TenancyService {
  get scope(): TenancyScope | undefined {
    return tenancyContext.get();
  }

  get tenant(): string | undefined {
    return tenancyContext.get()?.tenant;
  }

  disableTenancyForCurrentScope(): void {
    const scope = tenancyContext.get();
    if (!scope) return;
    tenancyContext.set({ ...scope, disableTenancy: true });
  }

  setTenant(tenant: string): void {
    const scope = tenancyContext.get();
    if (!scope) return;
    tenancyContext.set({ ...scope, tenant });
  }
}
