import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ReadinessIndicator } from './readiness.indicator';

const mockHealthCheckService = {
  check: jest.fn(),
};

const mockMongooseIndicator = {
  pingCheck: jest.fn(),
};

const mockMemoryIndicator = {
  checkHeap: jest.fn(),
};

const mockReadinessIndicator = {
  checkIndexes: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: typeof mockHealthCheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: MongooseHealthIndicator, useValue: mockMongooseIndicator },
        { provide: MemoryHealthIndicator, useValue: mockMemoryIndicator },
        { provide: ReadinessIndicator, useValue: mockReadinessIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = mockHealthCheckService;

    jest.clearAllMocks();
  });

  describe('liveness', () => {
    it('should return health check result', async () => {
      const mockResult = {
        status: 'ok',
        info: {
          mongodb: { status: 'up' },
          memory_heap: { status: 'up' },
        },
        details: {
          mongodb: { status: 'up' },
          memory_heap: { status: 'up' },
        },
      };
      healthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.liveness();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalled();
    });

    it('should check mongodb and memory', async () => {
      healthCheckService.check.mockImplementation(async (indicators) => {
        expect(indicators).toHaveLength(2);
        return { status: 'ok' };
      });

      await controller.liveness();

      expect(healthCheckService.check).toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('should return readiness check result', async () => {
      const mockResult = {
        status: 'ok',
        info: {
          mongodb: { status: 'up' },
          indexes: { status: 'up' },
        },
        details: {
          mongodb: { status: 'up' },
          indexes: { status: 'up' },
        },
      };
      healthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.readiness();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalled();
    });

    it('should check mongodb and indexes', async () => {
      healthCheckService.check.mockImplementation(async (indicators) => {
        expect(indicators).toHaveLength(2);
        return { status: 'ok' };
      });

      await controller.readiness();

      expect(healthCheckService.check).toHaveBeenCalled();
    });
  });
});
