import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DevController } from './dev.controller';
import { StructuredLoggerService } from '../common/logger/logger.service';
import type { Request } from 'express';

const mockLoggerService = {
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock the auth module
jest.mock('../auth/auth', () => {
  const context = {
    internalAdapter: {
      findUserByEmail: jest.fn(),
    },
  };
  const auth = {
    $context: Promise.resolve(context),
  };
  return {
    getAuth: () => auth,
  };
});

import { getAuth } from '../auth/auth';

describe('DevController', () => {
  let controller: DevController;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevController],
      providers: [
        { provide: StructuredLoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    controller = module.get<DevController>(DevController);

    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAuthUser', () => {
    const createMockRequest = (): Request => {
      return {
        requestId: 'req-1',
      } as unknown as Request;
    };

    it('should throw NotFoundException in production without debug flag', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DEV_DEBUG_AUTH = 'false';

      await expect(
        controller.getAuthUser('test@example.com', createMockRequest()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow access in non-production environment', async () => {
      process.env.NODE_ENV = 'development';
      const mockContext = await getAuth().$context;
      (
        mockContext.internalAdapter.findUserByEmail as jest.Mock
      ).mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          createdAt: new Date(),
        },
      });

      const result = await controller.getAuthUser(
        'test@example.com',
        createMockRequest(),
      );

      expect(result.exists).toBe(true);
      expect(result.userId).toBe('user-1');
    });

    it('should allow access in production with debug flag', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DEV_DEBUG_AUTH = 'true';
      const mockContext = await getAuth().$context;
      (
        mockContext.internalAdapter.findUserByEmail as jest.Mock
      ).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com' },
      });

      const result = await controller.getAuthUser(
        'test@example.com',
        createMockRequest(),
      );

      expect(result.exists).toBe(true);
    });

    it('should throw BadRequestException for missing email', async () => {
      process.env.NODE_ENV = 'development';

      await expect(
        controller.getAuthUser('', createMockRequest()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid email', async () => {
      process.env.NODE_ENV = 'development';

      await expect(
        controller.getAuthUser('invalid-email', createMockRequest()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return exists: false when user not found', async () => {
      process.env.NODE_ENV = 'development';
      const mockContext = await getAuth().$context;
      (
        mockContext.internalAdapter.findUserByEmail as jest.Mock
      ).mockResolvedValue({
        user: null,
      });

      const result = await controller.getAuthUser(
        'notfound@example.com',
        createMockRequest(),
      );

      expect(result.exists).toBe(false);
      expect(result.userId).toBeUndefined();
    });

    it('should log lookup request', async () => {
      process.env.NODE_ENV = 'development';
      const mockContext = await getAuth().$context;
      (
        mockContext.internalAdapter.findUserByEmail as jest.Mock
      ).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com' },
      });

      await controller.getAuthUser('test@example.com', createMockRequest());

      expect(mockLoggerService.log).toHaveBeenCalledWith(
        'dev.auth-user.lookup',
        expect.objectContaining({
          email: 'test@example.com',
          exists: true,
        }),
      );
    });

    it('should trim email before lookup', async () => {
      process.env.NODE_ENV = 'development';
      const mockContext = await getAuth().$context;
      (
        mockContext.internalAdapter.findUserByEmail as jest.Mock
      ).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com' },
      });

      await controller.getAuthUser('  test@example.com  ', createMockRequest());

      expect(mockContext.internalAdapter.findUserByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('should handle undefined email', async () => {
      process.env.NODE_ENV = 'development';

      await expect(
        controller.getAuthUser(undefined, createMockRequest()),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
