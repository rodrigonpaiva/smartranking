import { Test, TestingModule } from '@nestjs/testing';
import { RequestContextService, RequestContextStore } from './request-context.service';
import { Roles } from '../../auth/roles';
import type { AccessContext } from '../../auth/access-context.types';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestContextService],
    }).compile();

    service = module.get<RequestContextService>(RequestContextService);
  });

  describe('run', () => {
    it('should execute callback with context', () => {
      const store: RequestContextStore = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test',
        startedAt: Date.now(),
      };
      const callback = jest.fn().mockReturnValue('result');

      const result = service.run(store, callback);

      expect(callback).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should make context available inside callback', () => {
      const store: RequestContextStore = {
        requestId: 'req-123',
        method: 'POST',
        path: '/api/players',
        startedAt: Date.now(),
        tenantId: 'tenant-1',
        userId: 'user-1',
      };

      service.run(store, () => {
        const context = service.get();
        expect(context?.requestId).toBe('req-123');
        expect(context?.method).toBe('POST');
        expect(context?.tenantId).toBe('tenant-1');
        expect(context?.userId).toBe('user-1');
      });
    });

    it('should isolate context between runs', () => {
      const store1: RequestContextStore = {
        requestId: 'req-1',
        method: 'GET',
        path: '/path1',
        startedAt: Date.now(),
      };
      const store2: RequestContextStore = {
        requestId: 'req-2',
        method: 'POST',
        path: '/path2',
        startedAt: Date.now(),
      };

      service.run(store1, () => {
        expect(service.get()?.requestId).toBe('req-1');
      });

      service.run(store2, () => {
        expect(service.get()?.requestId).toBe('req-2');
      });
    });
  });

  describe('get', () => {
    it('should return undefined outside of run context', () => {
      const result = service.get();
      expect(result).toBeUndefined();
    });

    it('should return context inside run', () => {
      const store: RequestContextStore = {
        requestId: 'test-id',
        method: 'DELETE',
        path: '/api/resource',
        startedAt: 1234567890,
      };

      service.run(store, () => {
        const result = service.get();
        expect(result).toBeDefined();
        expect(result?.requestId).toBe('test-id');
        expect(result?.method).toBe('DELETE');
      });
    });
  });

  describe('merge', () => {
    it('should do nothing when called outside context', () => {
      expect(() => service.merge({ userId: 'new-user' })).not.toThrow();
    });

    it('should update context values inside run', () => {
      const store: RequestContextStore = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test',
        startedAt: Date.now(),
      };

      service.run(store, () => {
        service.merge({ userId: 'merged-user', tenantId: 'merged-tenant' });
        const context = service.get();
        expect(context?.userId).toBe('merged-user');
        expect(context?.tenantId).toBe('merged-tenant');
        expect(context?.requestId).toBe('req-1');
      });
    });

    it('should overwrite existing values', () => {
      const store: RequestContextStore = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test',
        startedAt: Date.now(),
        userId: 'original-user',
      };

      service.run(store, () => {
        service.merge({ userId: 'new-user' });
        expect(service.get()?.userId).toBe('new-user');
      });
    });
  });

  describe('registerAccessContext', () => {
    it('should register access context values', () => {
      const store: RequestContextStore = {
        requestId: 'req-1',
        method: 'POST',
        path: '/api/categories',
        startedAt: Date.now(),
      };

      const accessContext: AccessContext = {
        userId: 'user-abc',
        role: Roles.CLUB,
        tenantId: 'tenant-xyz',
        clubId: 'club-123',
      };

      service.run(store, () => {
        service.registerAccessContext(accessContext);
        const context = service.get();
        expect(context?.userId).toBe('user-abc');
        expect(context?.role).toBe(Roles.CLUB);
        expect(context?.tenantId).toBe('tenant-xyz');
        expect(context?.clubId).toBe('club-123');
      });
    });

    it('should handle access context without tenantId', () => {
      const store: RequestContextStore = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test',
        startedAt: Date.now(),
      };

      const accessContext: AccessContext = {
        userId: 'user-1',
        role: Roles.SYSTEM_ADMIN,
      };

      service.run(store, () => {
        service.registerAccessContext(accessContext);
        const context = service.get();
        expect(context?.tenantId).toBeNull();
      });
    });
  });

  describe('setTenant', () => {
    it('should set tenant id', () => {
      const store: RequestContextStore = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test',
        startedAt: Date.now(),
      };

      service.run(store, () => {
        service.setTenant('new-tenant');
        expect(service.get()?.tenantId).toBe('new-tenant');
      });
    });

    it('should handle null tenant', () => {
      const store: RequestContextStore = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test',
        startedAt: Date.now(),
        tenantId: 'existing-tenant',
      };

      service.run(store, () => {
        service.setTenant(null);
        expect(service.get()?.tenantId).toBeNull();
      });
    });

    it('should handle undefined tenant', () => {
      const store: RequestContextStore = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test',
        startedAt: Date.now(),
        tenantId: 'existing-tenant',
      };

      service.run(store, () => {
        service.setTenant(undefined);
        expect(service.get()?.tenantId).toBeNull();
      });
    });
  });
});
