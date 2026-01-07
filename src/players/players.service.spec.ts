import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';

const createMockPlayerModel = () => {
  const MockModel = function (data: unknown) {
    return {
      ...data,
      _id: 'player-id',
      save: jest.fn().mockResolvedValue({ ...data, _id: 'player-id' }),
    };
  };
  MockModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn() });
  MockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn() });
  MockModel.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  });
  MockModel.findOneAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn() });
  MockModel.deleteOne = jest.fn().mockReturnValue({ exec: jest.fn() });
  MockModel.countDocuments = jest.fn();
  return MockModel;
};

const createMockClubModel = () => {
  const MockModel = function () {};
  MockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn() });
  return MockModel;
};

const mockAuditService = {
  audit: jest.fn(),
};

describe('PlayersService', () => {
  let service: PlayersService;
  let playerModel: ReturnType<typeof createMockPlayerModel>;
  let clubModel: ReturnType<typeof createMockClubModel>;

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
    playerModel = createMockPlayerModel();
    clubModel = createMockClubModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        { provide: getModelToken('Player'), useValue: playerModel },
        { provide: getModelToken('Club'), useValue: clubModel },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
    jest.clearAllMocks();
  });

  describe('createPlayer', () => {
    const createDto = {
      name: 'Test Player',
      email: 'test@example.com',
      phone: '123456789',
      clubId: 'club-1',
    };

    it('should create a player successfully for admin', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      playerModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createPlayer(createDto, adminContext);

      expect(result).toBeDefined();
      expect(mockAuditService.audit).toHaveBeenCalled();
    });

    it('should throw BadRequestException when clubId missing for admin', async () => {
      const dtoWithoutClub = { ...createDto, clubId: undefined };

      await expect(
        service.createPlayer(dtoWithoutClub as typeof createDto, adminContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when club does not exist', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.createPlayer(createDto, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when email already exists', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      playerModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ email: 'test@example.com' }),
      });

      await expect(service.createPlayer(createDto, adminContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use context clubId for club users', async () => {
      const dtoWithoutClub = {
        name: 'Test',
        email: 'test@example.com',
        phone: '123',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      playerModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createPlayer(
        dtoWithoutClub as typeof createDto,
        clubContext,
      );

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for different club', async () => {
      const dtoForOtherClub = { ...createDto, clubId: 'other-club' };

      await expect(
        service.createPlayer(dtoForOtherClub, clubContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAllPlayers', () => {
    it('should return paginated players for admin', async () => {
      const mockPlayers = [
        { name: 'Player 1', email: 'p1@test.com' },
        { name: 'Player 2', email: 'p2@test.com' },
      ];
      playerModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPlayers),
      });
      playerModel.countDocuments.mockResolvedValue(2);

      const result = await service.getAllPlayers(
        { page: 1, limit: 10 },
        adminContext,
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by search query', async () => {
      playerModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      playerModel.countDocuments.mockResolvedValue(0);

      const result = await service.getAllPlayers(
        { page: 1, limit: 10, q: 'john' },
        adminContext,
      );

      expect(result.items).toHaveLength(0);
    });

    it('should scope to club for club users', async () => {
      playerModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      playerModel.countDocuments.mockResolvedValue(0);

      await service.getAllPlayers({ page: 1, limit: 10 }, clubContext);

      expect(playerModel.find).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when club user has no clubId', async () => {
      const contextWithoutClub: AccessContext = {
        userId: 'user',
        role: Roles.CLUB,
        tenantId: 'tenant-1',
      };

      await expect(
        service.getAllPlayers({ page: 1, limit: 10 }, contextWithoutClub),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPlayersByClubId', () => {
    it('should return players for specified club', async () => {
      playerModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      playerModel.countDocuments.mockResolvedValue(0);

      const result = await service.getPlayersByClubId('club-1', clubContext, {
        page: 1,
        limit: 10,
      });

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for different club access', async () => {
      await expect(
        service.getPlayersByClubId('other-club', clubContext, {
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to access any club', async () => {
      playerModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      playerModel.countDocuments.mockResolvedValue(0);

      const result = await service.getPlayersByClubId('any-club', adminContext, {
        page: 1,
        limit: 10,
      });

      expect(result).toBeDefined();
    });
  });

  describe('searchPlayers', () => {
    it('should return empty results for empty query', async () => {
      const result = await service.searchPlayers(
        { page: 1, limit: 10, q: '' },
        adminContext,
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return empty results for whitespace query', async () => {
      const result = await service.searchPlayers(
        { page: 1, limit: 10, q: '   ' },
        adminContext,
      );

      expect(result.items).toHaveLength(0);
    });

    it('should call getAllPlayers for valid query', async () => {
      playerModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      playerModel.countDocuments.mockResolvedValue(0);

      await service.searchPlayers({ page: 1, limit: 10, q: 'john' }, adminContext);

      expect(playerModel.find).toHaveBeenCalled();
    });
  });

  describe('updatePlayer', () => {
    it('should update player successfully', async () => {
      const mockPlayer = { _id: 'player-1', name: 'Old Name', clubId: 'club-1' };
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlayer),
      });
      playerModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPlayer, name: 'New Name' }),
      });

      const result = await service.updatePlayer(
        'player-1',
        { name: 'New Name' },
        clubContext,
      );

      expect(result.name).toBe('New Name');
      expect(mockAuditService.audit).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent player', async () => {
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updatePlayer('non-existent', { name: 'Test' }, clubContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for different club player', async () => {
      const mockPlayer = { _id: 'player-1', clubId: 'other-club' };
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlayer),
      });

      await expect(
        service.updatePlayer('player-1', { name: 'Test' }, clubContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPlayerById', () => {
    it('should return player when found', async () => {
      const mockPlayer = { _id: 'player-1', name: 'Test', clubId: 'club-1' };
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlayer),
      });

      const result = await service.getPlayerById('player-1', clubContext);

      expect(result).toEqual(mockPlayer);
    });

    it('should throw NotFoundException when player not found', async () => {
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getPlayerById('non-existent', clubContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPlayerByEmail', () => {
    it('should return player when found', async () => {
      const mockPlayer = { email: 'test@test.com', clubId: 'club-1' };
      playerModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlayer),
      });

      const result = await service.getPlayerByEmail('test@test.com', clubContext);

      expect(result).toEqual(mockPlayer);
    });

    it('should throw NotFoundException when player not found', async () => {
      playerModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getPlayerByEmail('unknown@test.com', clubContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPlayerByPhone', () => {
    it('should return player when found', async () => {
      const mockPlayer = { phone: '123456789', clubId: 'club-1' };
      playerModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlayer),
      });

      const result = await service.getPlayerByPhone('123456789', clubContext);

      expect(result).toEqual(mockPlayer);
    });

    it('should throw NotFoundException when player not found', async () => {
      playerModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getPlayerByPhone('000000000', clubContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePlayer', () => {
    it('should delete player successfully', async () => {
      const mockPlayer = { _id: 'player-1', clubId: 'club-1' };
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlayer),
      });
      playerModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      await service.deletePlayer('player-1', clubContext);

      expect(mockAuditService.audit).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent player', async () => {
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.deletePlayer('non-existent', clubContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for different club player', async () => {
      const mockPlayer = { _id: 'player-1', clubId: 'other-club' };
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlayer),
      });

      await expect(
        service.deletePlayer('player-1', clubContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
