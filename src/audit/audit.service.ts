import { Injectable } from '@nestjs/common';
import type { AccessContext } from '../auth/access-context.types';
import { StructuredLoggerService } from '../common/logger/logger.service';
import { RequestContextService } from '../common/logger/request-context.service';
import { AuditEvent } from './audit.events';

interface AuditMetadata {
  targetIds?: string[];
  [key: string]: unknown;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly requestContext: RequestContextService,
  ) {}

  audit(
    event: AuditEvent,
    context: AccessContext | null | undefined,
    metadata: AuditMetadata = {},
  ): void {
    const requestContext = this.requestContext.get();
    const payload = {
      event,
      tenantId: context?.tenantId ?? requestContext?.tenantId ?? null,
      actorUserId: context?.userId ?? requestContext?.userId ?? null,
      role: context?.role ?? requestContext?.role ?? null,
      clubId: context?.clubId ?? requestContext?.clubId ?? null,
      targetIds: metadata.targetIds ?? [],
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    this.logger.log('audit.event', payload);
  }
}
