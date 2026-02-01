import { Test, TestingModule } from '@nestjs/testing';
import { TenancyService } from './tenancy.service';
import { tenancyContext } from './tenancy.context';

jest.mock('./tenancy.context', () => ({
  tenancyContext: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

describe('TenancyService', () => {
  let service: TenancyService;
  const mockTenancyContext = tenancyContext as jest.Mocked<
    typeof tenancyContext
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenancyService],
    }).compile();

    service = module.get<TenancyService>(TenancyService);
    jest.clearAllMocks();
  });

  describe('scope', () => {
    it('should return undefined when no scope is set', () => {
      mockTenancyContext.get.mockReturnValue(undefined);

      expect(service.scope).toBeUndefined();
    });

    it('should return scope when set', () => {
      const mockScope = {
        tenant: 'tenant-1',
        allowMissingTenant: false,
        disableTenancy: false,
      };
      mockTenancyContext.get.mockReturnValue(mockScope);

      expect(service.scope).toEqual(mockScope);
    });
  });

  describe('tenant', () => {
    it('should return undefined when no scope is set', () => {
      mockTenancyContext.get.mockReturnValue(undefined);

      expect(service.tenant).toBeUndefined();
    });

    it('should return tenant id when scope is set', () => {
      mockTenancyContext.get.mockReturnValue({
        tenant: 'my-tenant',
        allowMissingTenant: false,
        disableTenancy: false,
      });

      expect(service.tenant).toBe('my-tenant');
    });
  });

  describe('disableTenancyForCurrentScope', () => {
    it('should do nothing when no scope exists', () => {
      mockTenancyContext.get.mockReturnValue(undefined);

      service.disableTenancyForCurrentScope();

      expect(mockTenancyContext.set).not.toHaveBeenCalled();
    });

    it('should set disableTenancy to true when scope exists', () => {
      const existingScope = {
        tenant: 'tenant-1',
        allowMissingTenant: false,
        disableTenancy: false,
      };
      mockTenancyContext.get.mockReturnValue(existingScope);

      service.disableTenancyForCurrentScope();

      expect(mockTenancyContext.set).toHaveBeenCalledWith({
        ...existingScope,
        disableTenancy: true,
      });
    });

    it('should preserve other scope properties when disabling', () => {
      const existingScope = {
        tenant: 'tenant-1',
        allowMissingTenant: false,
        disableTenancy: false,
      };
      mockTenancyContext.get.mockReturnValue(existingScope);

      service.disableTenancyForCurrentScope();

      expect(mockTenancyContext.set).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: 'tenant-1',
          disableTenancy: true,
        }),
      );
    });
  });

  describe('setTenant', () => {
    it('should do nothing when no scope exists', () => {
      mockTenancyContext.get.mockReturnValue(undefined);

      service.setTenant('new-tenant');

      expect(mockTenancyContext.set).not.toHaveBeenCalled();
    });

    it('should update tenant in existing scope', () => {
      const existingScope = {
        tenant: 'old-tenant',
        allowMissingTenant: false,
        disableTenancy: false,
      };
      mockTenancyContext.get.mockReturnValue(existingScope);

      service.setTenant('new-tenant');

      expect(mockTenancyContext.set).toHaveBeenCalledWith({
        ...existingScope,
        tenant: 'new-tenant',
      });
    });

    it('should preserve disableTenancy flag when updating tenant', () => {
      const existingScope = {
        tenant: 'old-tenant',
        allowMissingTenant: false,
        disableTenancy: true,
      };
      mockTenancyContext.get.mockReturnValue(existingScope);

      service.setTenant('new-tenant');

      expect(mockTenancyContext.set).toHaveBeenCalledWith({
        tenant: 'new-tenant',
        allowMissingTenant: false,
        disableTenancy: true,
      });
    });
  });
});
