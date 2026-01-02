import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/public.decorator';
import { ReadinessIndicator } from './readiness.indicator';

@Controller()
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly mongoIndicator: MongooseHealthIndicator,
    private readonly memoryIndicator: MemoryHealthIndicator,
    private readonly readinessIndicator: ReadinessIndicator,
  ) {}

  @Get('health')
  @Public()
  @HealthCheck()
  async liveness() {
    return this.healthCheckService.check([
      () => this.mongoIndicator.pingCheck('mongodb'),
      () =>
        this.memoryIndicator.checkHeap(
          'memory_heap',
          Number(process.env.HEALTH_MEMORY_LIMIT_BYTES ?? 300 * 1024 * 1024),
        ),
    ]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  async readiness() {
    return this.healthCheckService.check([
      () => this.mongoIndicator.pingCheck('mongodb'),
      () => this.readinessIndicator.checkIndexes(),
    ]);
  }
}
