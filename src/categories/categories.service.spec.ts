import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PlayersService } from '../players/players.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';

const mockCategoryModel = {
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  exec: jest.fn(),
};

const mockClubModel = {
  findById: jest.fn(),
};

const mockPlayersService = {
  getPlayerById: jest.fn(),
};

const mockAuditService = {
  audit: jest.fn(),
};

const createMockCategoryModel = () => {
  const MockModel = function (data: unknown) {
    return {
      ...data,
      _id: 'category-id',
      save: jest.fn().mockResolvedValue({ ...data, _id: 'category-id' }),
    };
  };
  MockModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn() });
  MockModel.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  });
  MockModel.findOneAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn() });
  MockModel.countDocuments = jest.fn();
  return MockModel;
};

const createMockClubModel = () => {
  const MockModel = function () {};
  MockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn() });
  return MockModel;
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryModel: ReturnType<typeof createMockCategoryModel>;
  let clubModel: ReturnType<typeof createMockClubModel>;
  let playersService: typeof mockPlayersService;
  let auditService: typeof mockAuditService;

  const adminContext: AccessContext = {
    userId: 'admin-user',
    role: Roles.SYSTEM_ADMIN,
    tenantId: 'tenant-1',
  };

  const clubContext: AccessContext = {
    userId: 'club-user',
    role: Roles.CLUB,
    clubId: 'club-1',
    tenantId: 'tenant-1',
  };

  beforeEach(async () => {
    categoryModel = createMockCategoryModel();
    clubModel = createMockClubModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getModelToken('Category'), useValue: categoryModel },
        { provide: getModelToken('Club'), useValue: clubModel },
        { provide: PlayersService, useValue: mockPlayersService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    playersService = mockPlayersService;
    auditService = mockAuditService;

    jest.clearAllMocks();
  });

  describe('createCategory', () => {
    const createDto = {
      category: 'Test Category',
      description: 'Test Description',
      clubId: 'club-1',
    };

    it('should create a category successfully for admin', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1', name: 'Club' }),
      });
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createCategory(createDto, adminContext);

      expect(result).toBeDefined();
      expect(auditService.audit).toHaveBeenCalled();
    });

    it('should throw NotFoundException when club does not exist', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createCategory(createDto, adminContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when category already exists', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ category: 'Test Category' }),
      });

      await expect(
        service.createCategory(createDto, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for admin without clubId', async () => {
      const dtoWithoutClub = { ...createDto, clubId: undefined };

      await expect(
        service.createCategory(
          dtoWithoutClub as typeof createDto,
          adminContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use context clubId for club users', async () => {
      const dtoWithoutClub = {
        category: 'Test',
        description: 'Test',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createCategory(
        dtoWithoutClub as typeof createDto,
        clubContext,
      );

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException when club user tries to create for different club', async () => {
      const dtoForDifferentClub = { ...createDto, clubId: 'other-club' };

      await expect(
        service.createCategory(dtoForDifferentClub, clubContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCategory', () => {
    it('should return paginated categories for admin', async () => {
      const mockCategories = [
        { category: 'Cat1', isDoubles: false },
        { category: 'Cat2', isDoubles: true },
      ];
      categoryModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCategories),
      });
      categoryModel.countDocuments.mockResolvedValue(2);

      const result = await service.getCategory(
        { page: 1, limit: 10 },
        adminContext,
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by search query', async () => {
      categoryModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      categoryModel.countDocuments.mockResolvedValue(0);

      const result = await service.getCategory(
        { page: 1, limit: 10, q: 'search' },
        adminContext,
      );

      expect(result.items).toHaveLength(0);
    });

    it('should scope to club for club users', async () => {
      categoryModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      categoryModel.countDocuments.mockResolvedValue(0);

      await service.getCategory({ page: 1, limit: 10 }, clubContext);

      expect(categoryModel.find).toHaveBeenCalled();
    });
  });

  describe('getCategoriesByPlayer', () => {
    it('should throw NotFoundException for undefined playerId', async () => {
      await expect(
        service.getCategoriesByPlayer(undefined, { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid playerId', async () => {
      await expect(
        service.getCategoriesByPlayer('invalid-id', { page: 1, limit: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return categories for valid player', async () => {
      const validId = '507f1f77bcf86cd799439011';
      categoryModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      categoryModel.countDocuments.mockResolvedValue(0);

      const result = await service.getCategoriesByPlayer(validId, {
        page: 1,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });
  });

  describe('getCategoryById', () => {
    it('should return category when found', async () => {
      const mockCategory = {
        category: 'Test',
        clubId: 'club-1',
        isDoubles: false,
      };
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });

      const result = await service.getCategoryById('Test', clubContext);

      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getCategoryById('NonExistent', clubContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong club access', async () => {
      const mockCategory = { category: 'Test', clubId: 'other-club' };
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });

      await expect(
        service.getCategoryById('Test', clubContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateCategory', () => {
    it('should update category successfully', async () => {
      const mockCategory = {
        _id: 'cat-id',
        category: 'Test',
        clubId: 'club-1',
      };
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });
      categoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockCategory, description: 'Updated' }),
      });

      const result = await service.updateCategory(
        'Test',
        { description: 'Updated' },
        clubContext,
      );

      expect(result.description).toBe('Updated');
      expect(auditService.audit).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent category', async () => {
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateCategory('NonExistent', { description: 'Test' }, clubContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignPlayerCategory', () => {
    it('should assign player to category successfully', async () => {
      const mockCategory = {
        _id: 'cat-id',
        category: 'Test',
        clubId: 'club-1',
        players: [],
      };
      const mockPlayer = { _id: 'player-1', clubId: 'club-1' };

      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });
      categoryModel.find.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      playersService.getPlayerById.mockResolvedValue(mockPlayer);
      categoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });

      await service.assignPlayerCategory('Test', 'player-1', clubContext);

      expect(auditService.audit).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent category', async () => {
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.assignPlayerCategory('NonExistent', 'player-1', clubContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when player already in category', async () => {
      const mockCategory = {
        category: 'Test',
        clubId: 'club-1',
        players: ['player-1'],
      };
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });
      categoryModel.find.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockCategory]),
      });
      playersService.getPlayerById.mockResolvedValue({
        _id: 'player-1',
        clubId: 'club-1',
      });

      await expect(
        service.assignPlayerCategory('Test', 'player-1', clubContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when player from different club', async () => {
      const mockCategory = {
        category: 'Test',
        clubId: 'club-1',
        players: [],
      };
      categoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });
      categoryModel.find.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      playersService.getPlayerById.mockResolvedValue({
        _id: 'player-1',
        clubId: 'other-club',
      });

      await expect(
        service.assignPlayerCategory('Test', 'player-1', clubContext),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
