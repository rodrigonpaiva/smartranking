import { AsyncLocalStorage } from 'node:async_hooks';
import { TenancyScope } from './tenancy.types';

const storage = new AsyncLocalStorage<TenancyScope>();

export const tenancyContext = {
  run<T>(scope: TenancyScope, fn: () => T): T {
    return storage.run(scope, fn);
  },
  get(): TenancyScope | undefined {
    return storage.getStore();
  },
  set(scope: TenancyScope): void {
    storage.enterWith(scope);
  },
};
