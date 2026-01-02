import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { AccessContext } from '../../auth/access-context.types';

export interface RequestContextStore {
  requestId: string;
  method: string;
  path: string;
  startedAt: number;
  tenantId?: string | null;
  userId?: string | null;
  role?: string | null;
  clubId?: string | null;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run({ ...store }, callback);
  }

  get(): RequestContextStore | undefined {
    return this.storage.getStore();
  }

  merge(values: Partial<RequestContextStore>): void {
    const store = this.storage.getStore();
    if (!store) {
      return;
    }
    Object.assign(store, values);
  }

  registerAccessContext(context: AccessContext): void {
    this.merge({
      userId: context.userId,
      role: context.role,
      tenantId: context.tenantId ?? null,
      clubId: context.clubId,
    });
  }

  setTenant(tenantId: string | null | undefined): void {
    this.merge({ tenantId: tenantId ?? null });
  }
}
