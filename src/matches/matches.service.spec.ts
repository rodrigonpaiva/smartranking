import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuditService } from '../audit/audit.service';
import { StructuredLoggerService } from '../common/logger/logger.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';

const createMockMatchModel = () => {
  const MockModel = function (data: Record<string, unknown> = {}) {
    return {
      ...data,
      _id: 'match-id',
      save: jest.fn().mockResolvedValue({ ...data, _id: 'match-id' }),
    };
  };
  MockModel.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  });
  MockModel.countDocuments = jest.fn();
  return MockModel;
};

const createMockCategoryModel = () => {
  const MockModel = function () {};
  MockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn() });
  return MockModel;
};

const createMockClubModel = () => {
  const MockModel = function () {};
  MockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn() });
  return MockModel;
};

const createMockPlayerModel = () => {
  const MockModel = function () {};
  MockModel.find = jest.fn().mockReturnValue({
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  });
  return MockModel;
};

const mockTenancyService = {
  tenant: 'tenant-1',
};

const mockAuditService = {
  audit: jest.fn(),
};

const mockLoggerService = {
  debug: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
};

describe('MatchesService', () => {
  let service: MatchesService;
  let matchModel: ReturnType<typeof createMockMatchModel>;
  let categoryModel: ReturnType<typeof createMockCategoryModel>;
  let clubModel: ReturnType<typeof createMockClubModel>;
  let playerModel: ReturnType<typeof createMockPlayerModel>;

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
    matchModel = createMockMatchModel();
    categoryModel = createMockCategoryModel();
    clubModel = createMockClubModel();
    playerModel = createMockPlayerModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getModelToken('Match'), useValue: matchModel },
        { provide: getModelToken('Category'), useValue: categoryModel },
        { provide: getModelToken('Club'), useValue: clubModel },
        { provide: getModelToken('Player'), useValue: playerModel },
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: StructuredLoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    jest.clearAllMocks();
  });

  describe('createMatch', () => {
    const baseMatchDto = {
      clubId: 'club-1',
      categoryId: 'category-1',
      format: 'SINGLES' as const,
      bestOf: 3,
      decidingSetType: 'STANDARD' as const,
      teams: [{ players: ['player-1'] }, { players: ['player-2'] }],
      sets: [
        {
          games: [
            { teamIndex: 0, score: 6 },
            { teamIndex: 1, score: 4 },
          ],
        },
        {
          games: [
            { teamIndex: 0, score: 6 },
            { teamIndex: 1, score: 3 },
          ],
        },
      ],
    };

    it('should throw NotFoundException when club not found', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createMatch(baseMatchDto, clubContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when category not found', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createMatch(baseMatchDto, clubContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for even bestOf', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });

      const invalidDto = { ...baseMatchDto, bestOf: 2 };

      await expect(
        service.createMatch(invalidDto, clubContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for wrong number of teams', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });

      const invalidDto = {
        ...baseMatchDto,
        teams: [{ players: ['player-1'] }],
      };

      await expect(
        service.createMatch(invalidDto, clubContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate players', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });

      const invalidDto = {
        ...baseMatchDto,
        teams: [{ players: ['player-1'] }, { players: ['player-1'] }],
      };

      await expect(
        service.createMatch(invalidDto, clubContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when category belongs to different club', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });

      const dtoWithMismatch = {
        ...baseMatchDto,
        clubId: 'club-different',
        categoryId: 'category-1',
      };

      // Category's clubId doesn't match DTO's clubId
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-different' }),
      });
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });

      await expect(
        service.createMatch(dtoWithMismatch, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for wrong club access', async () => {
      const dtoForOtherClub = { ...baseMatchDto, clubId: 'other-club' };

      await expect(
        service.createMatch(dtoForOtherClub, clubContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMatches', () => {
    it('should return paginated matches for admin', async () => {
      const mockMatches = [
        { _id: 'match-1', clubId: 'club-1' },
        { _id: 'match-2', clubId: 'club-1' },
      ];
      matchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMatches),
      });
      matchModel.countDocuments.mockResolvedValue(2);

      const result = await service.getMatches(
        { page: 1, limit: 10 },
        adminContext,
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by clubId for club users', async () => {
      matchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      matchModel.countDocuments.mockResolvedValue(0);

      await service.getMatches({ page: 1, limit: 10 }, clubContext);

      expect(matchModel.find).toHaveBeenCalled();
    });

    it('should filter by categoryId when provided', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });
      matchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      matchModel.countDocuments.mockResolvedValue(0);

      await service.getMatches(
        { page: 1, limit: 10, categoryId: 'category-1' },
        clubContext,
      );

      expect(categoryModel.findById).toHaveBeenCalledWith('category-1');
    });

    it('should throw NotFoundException for invalid categoryId', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getMatches(
          { page: 1, limit: 10, categoryId: 'invalid' },
          clubContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when club user has no clubId', async () => {
      const contextWithoutClub: AccessContext = {
        userId: 'user',
        role: Roles.CLUB,
        tenantId: 'tenant-1',
      };

      await expect(
        service.getMatches({ page: 1, limit: 10 }, contextWithoutClub),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMatchesByCategory', () => {
    it('should return matches for category', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });
      matchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      matchModel.countDocuments.mockResolvedValue(0);

      const result = await service.getMatchesByCategory(
        'category-1',
        { page: 1, limit: 10 },
        clubContext,
      );

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for non-existent category', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getMatchesByCategory(
          'invalid',
          { page: 1, limit: 10 },
          clubContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by playerId when provided', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });
      matchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      matchModel.countDocuments.mockResolvedValue(0);

      await service.getMatchesByCategory(
        'category-1',
        { page: 1, limit: 10 },
        clubContext,
        'player-1',
      );

      expect(matchModel.find).toHaveBeenCalled();
    });
  });

  describe('ensurePlayerInCategory', () => {
    it('should throw NotFoundException for non-existent category', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.ensurePlayerInCategory('invalid', 'player-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when player not in category', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'category-1',
          players: ['other-player'],
        }),
      });

      await expect(
        service.ensurePlayerInCategory('category-1', 'player-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass when player is in category', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'category-1',
          players: ['player-1'],
        }),
      });

      await expect(
        service.ensurePlayerInCategory('category-1', 'player-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('getRankingByCategory', () => {
    it('should return empty ranking when no matches', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'category-1', clubId: 'club-1' }),
      });
      matchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getRankingByCategory(
        'category-1',
        { page: 1, limit: 10 },
        clubContext,
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw NotFoundException for non-existent category', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getRankingByCategory(
          'invalid',
          { page: 1, limit: 10 },
          clubContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong club access', async () => {
      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'category-1',
          clubId: 'other-club',
        }),
      });

      await expect(
        service.getRankingByCategory(
          'category-1',
          { page: 1, limit: 10 },
          clubContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should calculate ranking from matches', async () => {
      const mockCategory = {
        _id: 'category-1',
        clubId: 'club-1',
        isDoubles: false,
      };
      const mockMatches = [
        {
          _id: 'match-1',
          participants: [
            { playerId: 'player-1', result: 'WIN' },
            { playerId: 'player-2', result: 'LOSS' },
          ],
          teams: [{ players: ['player-1'] }, { players: ['player-2'] }],
          playedAt: new Date(),
        },
      ];
      const mockPlayers = [
        {
          _id: 'player-1',
          name: 'Player 1',
          email: 'p1@test.com',
          clubId: 'club-1',
        },
        {
          _id: 'player-2',
          name: 'Player 2',
          email: 'p2@test.com',
          clubId: 'club-1',
        },
      ];

      categoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });
      matchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMatches),
      });
      playerModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPlayers),
      });

      const result = await service.getRankingByCategory(
        'category-1',
        { page: 1, limit: 10 },
        clubContext,
      );

      expect(result.items.length).toBeGreaterThan(0);
      expect(mockLoggerService.debug).toHaveBeenCalled();
    });
  });
});
