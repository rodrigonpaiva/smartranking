import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ReadinessIndicator } from './readiness.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [ReadinessIndicator],
})
export class HealthModule {}
