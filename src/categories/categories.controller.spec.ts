import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';
import type { Request } from 'express';

type RequestWithContext = Request & { accessContext?: AccessContext | null };

const mockCategoriesService = {
  createCategory: jest.fn(),
  getCategory: jest.fn(),
  getCategoriesByPlayer: jest.fn(),
  getCategoryById: jest.fn(),
  updateCategory: jest.fn(),
  assignPlayerCategory: jest.fn(),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: typeof mockCategoriesService;

  const mockAccessContext: AccessContext = {
    userId: 'user-1',
    role: Roles.CLUB,
    clubId: 'club-1',
    tenantId: 'tenant-1',
  };

  const createMockRequest = (
    context?: AccessContext | null,
  ): RequestWithContext => {
    return {
      accessContext: context,
    } as RequestWithContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = mockCategoriesService;

    jest.clearAllMocks();
  });

  describe('createCategory', () => {
    const createDto = {
      category: 'Test Category',
      description: 'Test Description',
      clubId: 'club-1',
    };

    it('should create a category', async () => {
      const mockCategory = { _id: 'cat-1', ...createDto };
      service.createCategory.mockResolvedValue(mockCategory);

      const result = await controller.createCategory(
        createMockRequest(mockAccessContext),
        createDto,
      );

      expect(result).toEqual(mockCategory);
      expect(service.createCategory).toHaveBeenCalledWith(
        createDto,
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.createCategory(createMockRequest(null), createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCategory', () => {
    it('should return categories array', async () => {
      const mockCategories = [{ category: 'Cat1' }, { category: 'Cat2' }];
      service.getCategory.mockResolvedValue({
        items: mockCategories,
        total: 2,
      });

      const result = await controller.getCategory(
        createMockRequest(mockAccessContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockCategories);
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getCategory(createMockRequest(null), { page: 1, limit: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyCategories', () => {
    it('should return player categories', async () => {
      const mockCategories = [{ category: 'PlayerCat' }];
      const playerContext: AccessContext = {
        ...mockAccessContext,
        role: Roles.PLAYER,
        playerId: 'player-1',
      };
      const request = {
        accessContext: playerContext,
      } as RequestWithContext;

      service.getCategoriesByPlayer.mockResolvedValue({
        items: mockCategories,
        total: 1,
      });

      const result = await controller.getMyCategories(request, {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockCategories);
      expect(service.getCategoriesByPlayer).toHaveBeenCalledWith('player-1', {
        page: 1,
        limit: 10,
      });
    });
  });

  describe('getCategorieById', () => {
    it('should return category by id', async () => {
      const mockCategory = { category: 'Test', description: 'Test Desc' };
      service.getCategoryById.mockResolvedValue(mockCategory);

      const result = await controller.getCategorieById(
        'Test',
        createMockRequest(mockAccessContext),
      );

      expect(result).toEqual(mockCategory);
      expect(service.getCategoryById).toHaveBeenCalledWith(
        'Test',
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getCategorieById('Test', createMockRequest(null)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateCategory', () => {
    const updateDto = { description: 'Updated Description' };

    it('should update category', async () => {
      const mockCategory = { category: 'Test', ...updateDto };
      service.updateCategory.mockResolvedValue(mockCategory);

      const result = await controller.updateCategory(
        createMockRequest(mockAccessContext),
        updateDto,
        'Test',
      );

      expect(result).toEqual(mockCategory);
      expect(service.updateCategory).toHaveBeenCalledWith(
        'Test',
        updateDto,
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.updateCategory(createMockRequest(null), updateDto, 'Test'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignPlayerCategory', () => {
    it('should assign player to category', async () => {
      service.assignPlayerCategory.mockResolvedValue(undefined);

      await controller.assignPlayerCategory(
        'TestCategory',
        'player-1',
        createMockRequest(mockAccessContext),
      );

      expect(service.assignPlayerCategory).toHaveBeenCalledWith(
        'TestCategory',
        'player-1',
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.assignPlayerCategory(
          'TestCategory',
          'player-1',
          createMockRequest(null),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
