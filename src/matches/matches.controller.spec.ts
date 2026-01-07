import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';
import type { Request } from 'express';

type RequestWithContext = Request & { accessContext?: AccessContext | null };

const mockMatchesService = {
  createMatch: jest.fn(),
  getMatches: jest.fn(),
  getMatchesByCategory: jest.fn(),
  ensurePlayerInCategory: jest.fn(),
  getRankingByCategory: jest.fn(),
};

describe('MatchesController', () => {
  let controller: MatchesController;
  let service: typeof mockMatchesService;

  const mockAccessContext: AccessContext = {
    userId: 'user-1',
    role: Roles.CLUB,
    clubId: 'club-1',
    tenantId: 'tenant-1',
  };

  const mockPlayerContext: AccessContext = {
    userId: 'player-user-1',
    role: Roles.PLAYER,
    clubId: 'club-1',
    playerId: 'player-1',
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
      controllers: [MatchesController],
      providers: [
        { provide: MatchesService, useValue: mockMatchesService },
      ],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
    service = mockMatchesService;

    jest.clearAllMocks();
  });

  describe('createMatch', () => {
    const createDto = {
      clubId: 'club-1',
      categoryId: 'category-1',
      format: 'SINGLES' as const,
      bestOf: 3,
      decidingSetType: 'STANDARD' as const,
      teams: [
        { players: ['player-1'] },
        { players: ['player-2'] },
      ],
      sets: [
        { games: [{ teamIndex: 0, score: 6 }, { teamIndex: 1, score: 4 }] },
        { games: [{ teamIndex: 0, score: 6 }, { teamIndex: 1, score: 3 }] },
      ],
    };

    it('should create a match', async () => {
      const mockMatch = { _id: 'match-1', ...createDto };
      service.createMatch.mockResolvedValue(mockMatch);

      const result = await controller.createMatch(
        createMockRequest(mockAccessContext),
        createDto,
      );

      expect(result).toEqual(mockMatch);
      expect(service.createMatch).toHaveBeenCalledWith(
        createDto,
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.createMatch(createMockRequest(null), createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMatches', () => {
    it('should return paginated matches', async () => {
      const mockResult = {
        items: [{ _id: 'match-1' }, { _id: 'match-2' }],
        total: 2,
        page: 1,
        limit: 10,
      };
      service.getMatches.mockResolvedValue(mockResult);

      const result = await controller.getMatches(
        createMockRequest(mockAccessContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockResult);
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getMatches(createMockRequest(null), { page: 1, limit: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMatchesByCategory', () => {
    it('should return matches for category', async () => {
      const mockResult = {
        items: [{ _id: 'match-1' }],
        total: 1,
        page: 1,
        limit: 10,
      };
      service.getMatchesByCategory.mockResolvedValue(mockResult);

      const result = await controller.getMatchesByCategory(
        'category-1',
        createMockRequest(mockAccessContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockResult);
      expect(service.getMatchesByCategory).toHaveBeenCalledWith(
        'category-1',
        { page: 1, limit: 10 },
        mockAccessContext,
        undefined,
      );
    });

    it('should filter by player for player role', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      };
      service.ensurePlayerInCategory.mockResolvedValue(undefined);
      service.getMatchesByCategory.mockResolvedValue(mockResult);

      const result = await controller.getMatchesByCategory(
        'category-1',
        createMockRequest(mockPlayerContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockResult);
      expect(service.ensurePlayerInCategory).toHaveBeenCalledWith(
        'category-1',
        'player-1',
      );
      expect(service.getMatchesByCategory).toHaveBeenCalledWith(
        'category-1',
        { page: 1, limit: 10 },
        mockPlayerContext,
        'player-1',
      );
    });

    it('should throw ForbiddenException for player without playerId', async () => {
      const contextWithoutPlayerId: AccessContext = {
        userId: 'player-user',
        role: Roles.PLAYER,
        clubId: 'club-1',
        tenantId: 'tenant-1',
      };

      await expect(
        controller.getMatchesByCategory(
          'category-1',
          createMockRequest(contextWithoutPlayerId),
          { page: 1, limit: 10 },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getMatchesByCategory(
          'category-1',
          createMockRequest(null),
          { page: 1, limit: 10 },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRankingByCategory', () => {
    it('should return ranking for category', async () => {
      const mockResult = {
        items: [
          { _id: 'player-1', name: 'Player 1', points: 30, position: 1 },
          { _id: 'player-2', name: 'Player 2', points: 20, position: 2 },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };
      service.getRankingByCategory.mockResolvedValue(mockResult);

      const result = await controller.getRankingByCategory(
        'category-1',
        createMockRequest(mockAccessContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockResult);
      expect(service.getRankingByCategory).toHaveBeenCalledWith(
        'category-1',
        { page: 1, limit: 10 },
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getRankingByCategory(
          'category-1',
          createMockRequest(null),
          { page: 1, limit: 10 },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
