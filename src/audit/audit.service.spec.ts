import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { AuditEvent } from './audit.events';
import { StructuredLoggerService } from '../common/logger/logger.service';
import { RequestContextService } from '../common/logger/request-context.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';

describe('AuditService', () => {
  let service: AuditService;
  let loggerService: jest.Mocked<StructuredLoggerService>;
  let requestContextService: jest.Mocked<RequestContextService>;

  const mockAccessContext: AccessContext = {
    userId: 'user-1',
    role: Roles.CLUB,
    clubId: 'club-1',
    tenantId: 'tenant-1',
  };

  beforeEach(async () => {
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockRequestContext = {
      get: jest.fn(),
      merge: jest.fn(),
      run: jest.fn(),
      registerAccessContext: jest.fn(),
      setTenant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: StructuredLoggerService, useValue: mockLogger },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    loggerService = module.get(StructuredLoggerService);
    requestContextService = module.get(RequestContextService);

    jest.clearAllMocks();
  });

  describe('audit', () => {
    it('should log audit event with context', () => {
      requestContextService.get.mockReturnValue(undefined);

      service.audit(AuditEvent.PLAYER_CREATED, mockAccessContext, {
        targetIds: ['player-1'],
      });

      expect(loggerService.log).toHaveBeenCalledWith(
        'audit.event',
        expect.objectContaining({
          event: AuditEvent.PLAYER_CREATED,
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          role: Roles.CLUB,
          clubId: 'club-1',
          targetIds: ['player-1'],
        }),
      );
    });

    it('should use request context when access context is null', () => {
      requestContextService.get.mockReturnValue({
        requestId: 'req-1',
        method: 'POST',
        path: '/api/v1/players',
        startedAt: Date.now(),
        tenantId: 'tenant-from-context',
        userId: 'user-from-context',
        role: Roles.SYSTEM_ADMIN,
        clubId: 'club-from-context',
      });

      service.audit(AuditEvent.CLUB_CREATED, null, {});

      expect(loggerService.log).toHaveBeenCalledWith(
        'audit.event',
        expect.objectContaining({
          event: AuditEvent.CLUB_CREATED,
          tenantId: 'tenant-from-context',
          actorUserId: 'user-from-context',
          role: Roles.SYSTEM_ADMIN,
          clubId: 'club-from-context',
        }),
      );
    });

    it('should handle undefined context', () => {
      requestContextService.get.mockReturnValue(undefined);

      service.audit(AuditEvent.MATCH_CREATED, undefined, {
        targetIds: ['match-1'],
      });

      expect(loggerService.log).toHaveBeenCalledWith(
        'audit.event',
        expect.objectContaining({
          event: AuditEvent.MATCH_CREATED,
          tenantId: null,
          actorUserId: null,
          role: null,
          clubId: null,
          targetIds: ['match-1'],
        }),
      );
    });

    it('should include additional metadata', () => {
      requestContextService.get.mockReturnValue(undefined);

      service.audit(AuditEvent.CATEGORY_UPDATED, mockAccessContext, {
        targetIds: ['category-1'],
        customField: 'custom-value',
        numericField: 42,
      });

      expect(loggerService.log).toHaveBeenCalledWith(
        'audit.event',
        expect.objectContaining({
          event: AuditEvent.CATEGORY_UPDATED,
          targetIds: ['category-1'],
          customField: 'custom-value',
          numericField: 42,
        }),
      );
    });

    it('should include timestamp in audit log', () => {
      requestContextService.get.mockReturnValue(undefined);
      const beforeTimestamp = new Date().toISOString();

      service.audit(AuditEvent.PLAYER_DELETED, mockAccessContext, {});

      const callArgs = loggerService.log.mock.calls[0][1];
      expect(callArgs.timestamp).toBeDefined();
      expect(new Date(callArgs.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTimestamp).getTime(),
      );
    });

    it('should default targetIds to empty array', () => {
      requestContextService.get.mockReturnValue(undefined);

      service.audit(AuditEvent.CLUB_UPDATED, mockAccessContext, {});

      expect(loggerService.log).toHaveBeenCalledWith(
        'audit.event',
        expect.objectContaining({
          targetIds: [],
        }),
      );
    });

    it('should handle all audit event types', () => {
      requestContextService.get.mockReturnValue(undefined);

      const events = [
        AuditEvent.PLAYER_CREATED,
        AuditEvent.PLAYER_UPDATED,
        AuditEvent.PLAYER_DELETED,
        AuditEvent.CLUB_CREATED,
        AuditEvent.CLUB_UPDATED,
        AuditEvent.CLUB_DELETED,
        AuditEvent.CATEGORY_CREATED,
        AuditEvent.CATEGORY_UPDATED,
        AuditEvent.MATCH_CREATED,
        AuditEvent.PROFILE_UPDATED,
        AuditEvent.MODERATOR_ASSIGNED,
      ];

      events.forEach((event) => {
        service.audit(event, mockAccessContext, {});
      });

      expect(loggerService.log).toHaveBeenCalledTimes(events.length);
    });
  });
});
