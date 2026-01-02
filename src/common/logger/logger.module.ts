import { Global, Module } from '@nestjs/common';
import { StructuredLoggerService } from './logger.service';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [StructuredLoggerService, RequestContextService],
  exports: [StructuredLoggerService, RequestContextService],
})
export class LoggerModule {}
