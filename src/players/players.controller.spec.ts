import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';
import type { Request } from 'express';

type RequestWithContext = Request & { accessContext?: AccessContext | null };

const mockPlayersService = {
  createPlayer: jest.fn(),
  getAllPlayers: jest.fn(),
  searchPlayers: jest.fn(),
  getPlayerByEmail: jest.fn(),
  getPlayersByClubId: jest.fn(),
  getPlayerByPhone: jest.fn(),
  getPlayerById: jest.fn(),
  updatePlayer: jest.fn(),
  deletePlayer: jest.fn(),
};

describe('PlayersController', () => {
  let controller: PlayersController;
  let service: typeof mockPlayersService;

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
      controllers: [PlayersController],
      providers: [{ provide: PlayersService, useValue: mockPlayersService }],
    }).compile();

    controller = module.get<PlayersController>(PlayersController);
    service = mockPlayersService;

    jest.clearAllMocks();
  });

  describe('createPlayer', () => {
    const createDto = {
      name: 'Test Player',
      email: 'test@example.com',
      phone: '123456789',
      clubId: 'club-1',
    };

    it('should create a player', async () => {
      const mockPlayer = { _id: 'player-1', ...createDto };
      service.createPlayer.mockResolvedValue(mockPlayer);

      const result = await controller.createPlayer(
        createMockRequest(mockAccessContext),
        createDto,
      );

      expect(result).toEqual(mockPlayer);
      expect(service.createPlayer).toHaveBeenCalledWith(
        createDto,
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.createPlayer(createMockRequest(null), createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAllPlayers', () => {
    it('should return paginated players', async () => {
      const mockResult = {
        items: [{ name: 'Player 1' }, { name: 'Player 2' }],
        total: 2,
        page: 1,
        limit: 10,
      };
      service.getAllPlayers.mockResolvedValue(mockResult);

      const result = await controller.getAllPlayers(
        createMockRequest(mockAccessContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockResult);
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getAllPlayers(createMockRequest(null), {
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('searchPlayers', () => {
    it('should search players by query', async () => {
      const mockResult = { items: [], total: 0, page: 1, limit: 10 };
      service.searchPlayers.mockResolvedValue(mockResult);

      const result = await controller.searchPlayers(
        createMockRequest(mockAccessContext),
        { page: 1, limit: 10, q: 'john' },
      );

      expect(result).toEqual(mockResult);
      expect(service.searchPlayers).toHaveBeenCalledWith(
        { page: 1, limit: 10, q: 'john' },
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.searchPlayers(createMockRequest(null), {
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPlayerByEmail', () => {
    it('should return player by email', async () => {
      const mockPlayer = { email: 'test@example.com', name: 'Test' };
      service.getPlayerByEmail.mockResolvedValue(mockPlayer);

      const result = await controller.getPlayerByEmail(
        createMockRequest(mockAccessContext),
        'test@example.com',
      );

      expect(result).toEqual(mockPlayer);
      expect(service.getPlayerByEmail).toHaveBeenCalledWith(
        'test@example.com',
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getPlayerByEmail(
          createMockRequest(null),
          'test@example.com',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPlayersByClub', () => {
    it('should return players by club id', async () => {
      const mockResult = { items: [], total: 0, page: 1, limit: 10 };
      service.getPlayersByClubId.mockResolvedValue(mockResult);

      const result = await controller.getPlayersByClub(
        'club-1',
        createMockRequest(mockAccessContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockResult);
      expect(service.getPlayersByClubId).toHaveBeenCalledWith(
        'club-1',
        mockAccessContext,
        { page: 1, limit: 10 },
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getPlayersByClub('club-1', createMockRequest(null), {
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPlayerByPhone', () => {
    it('should return player by phone', async () => {
      const mockPlayer = { phone: '123456789', name: 'Test' };
      service.getPlayerByPhone.mockResolvedValue(mockPlayer);

      const result = await controller.getPlayerByPhone(
        createMockRequest(mockAccessContext),
        { phone: '123456789' },
      );

      expect(result).toEqual(mockPlayer);
      expect(service.getPlayerByPhone).toHaveBeenCalledWith(
        '123456789',
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getPlayerByPhone(createMockRequest(null), {
          phone: '123456789',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPlayerByid', () => {
    it('should return player by id', async () => {
      const mockPlayer = { _id: 'player-1', name: 'Test' };
      service.getPlayerById.mockResolvedValue(mockPlayer);

      const result = await controller.getPlayerByid(
        createMockRequest(mockAccessContext),
        'player-1',
      );

      expect(result).toEqual(mockPlayer);
      expect(service.getPlayerById).toHaveBeenCalledWith(
        'player-1',
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getPlayerByid(createMockRequest(null), 'player-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updatePlayer', () => {
    const updateDto = { name: 'Updated Name', phone: '11999999999' };

    it('should update player', async () => {
      const mockPlayer = { _id: 'player-1', ...updateDto };
      service.updatePlayer.mockResolvedValue(mockPlayer);

      const result = await controller.updatePlayer(
        createMockRequest(mockAccessContext),
        updateDto,
        'player-1',
      );

      expect(result).toEqual(mockPlayer);
      expect(service.updatePlayer).toHaveBeenCalledWith(
        'player-1',
        updateDto,
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.updatePlayer(createMockRequest(null), updateDto, 'player-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePlayer', () => {
    it('should delete player', async () => {
      service.deletePlayer.mockResolvedValue(undefined);

      await controller.deletePlayer(
        createMockRequest(mockAccessContext),
        'player-1',
      );

      expect(service.deletePlayer).toHaveBeenCalledWith(
        'player-1',
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.deletePlayer(createMockRequest(null), 'player-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
