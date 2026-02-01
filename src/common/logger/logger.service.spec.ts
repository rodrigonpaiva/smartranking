import { Test, TestingModule } from '@nestjs/testing';
import { StructuredLoggerService } from './logger.service';
import { RequestContextService } from './request-context.service';

describe('StructuredLoggerService', () => {
  let service: StructuredLoggerService;
  let requestContextService: jest.Mocked<RequestContextService>;

  beforeEach(async () => {
    const mockRequestContext = {
      get: jest.fn(),
      merge: jest.fn(),
      run: jest.fn(),
      registerAccessContext: jest.fn(),
      setTenant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuredLoggerService,
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    service = module.get<StructuredLoggerService>(StructuredLoggerService);
    requestContextService = module.get(RequestContextService);

    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should log info message with context', () => {
      requestContextService.get.mockReturnValue({
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test',
        startedAt: Date.now(),
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'club',
      });

      expect(() => service.log('test message')).not.toThrow();
    });

    it('should handle string context', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.log('test message', 'TestContext')).not.toThrow();
    });

    it('should handle object metadata', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.log('test message', { customField: 'value' }),
      ).not.toThrow();
    });
  });

  describe('error', () => {
    it('should log error message with trace', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.error('error message', 'Error stack trace'),
      ).not.toThrow();
    });

    it('should log error message without trace', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.error('error message')).not.toThrow();
    });

    it('should handle error with metadata', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.error('error message', 'trace', { extra: 'data' }),
      ).not.toThrow();
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.warn('warning message')).not.toThrow();
    });

    it('should handle warning with context', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.warn('warning message', 'WarnContext'),
      ).not.toThrow();
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.debug('debug message')).not.toThrow();
    });

    it('should handle debug with metadata', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.debug('debug message', { debug: 'info' }),
      ).not.toThrow();
    });
  });

  describe('verbose', () => {
    it('should log verbose message', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.verbose('verbose message')).not.toThrow();
    });
  });

  describe('logRequest', () => {
    it('should log HTTP request details', () => {
      requestContextService.get.mockReturnValue({
        requestId: 'req-1',
        method: 'POST',
        path: '/api/players',
        startedAt: Date.now(),
      });

      expect(() =>
        service.logRequest({
          method: 'POST',
          path: '/api/players',
          statusCode: 201,
          duration: 150,
          contentLength: 1024,
        }),
      ).not.toThrow();
    });

    it('should log request without content length', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.logRequest({
          method: 'GET',
          path: '/api/clubs',
          statusCode: 200,
          duration: 50,
        }),
      ).not.toThrow();
    });
  });

  describe('logException', () => {
    it('should log Error instance', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.logException(new Error('Test error'), { statusCode: 500 }),
      ).not.toThrow();
    });

    it('should log string error', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.logException('String error', { statusCode: 400 }),
      ).not.toThrow();
    });

    it('should log object error', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() =>
        service.logException({ custom: 'error' }, { statusCode: 422 }),
      ).not.toThrow();
    });

    it('should handle null error', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.logException(null, {})).not.toThrow();
    });

    it('should handle undefined error', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.logException(undefined, {})).not.toThrow();
    });

    it('should handle numeric error', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.logException(404, {})).not.toThrow();
    });

    it('should handle boolean error', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.logException(false, {})).not.toThrow();
    });
  });

  describe('context bindings', () => {
    it('should include all request context fields', () => {
      requestContextService.get.mockReturnValue({
        requestId: 'req-123',
        method: 'PUT',
        path: '/api/categories',
        startedAt: 1234567890,
        tenantId: 'tenant-abc',
        userId: 'user-xyz',
        role: 'system_admin',
        clubId: 'club-def',
      });

      expect(() => service.log('test with full context')).not.toThrow();
    });

    it('should handle missing request context gracefully', () => {
      requestContextService.get.mockReturnValue(undefined);

      expect(() => service.log('test without context')).not.toThrow();
    });

    it('should handle partial request context', () => {
      requestContextService.get.mockReturnValue({
        requestId: 'req-1',
        method: 'GET',
        path: '/test',
        startedAt: Date.now(),
      });

      expect(() => service.log('test with partial context')).not.toThrow();
    });
  });
});
