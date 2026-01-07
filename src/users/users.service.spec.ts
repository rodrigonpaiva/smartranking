import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UserProfilesService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';

const createMockUserProfileModel = () => {
  const MockModel = function (data: unknown) {
    return {
      ...data,
      save: jest.fn().mockResolvedValue(data),
    };
  };
  MockModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn() });
  MockModel.findOneAndUpdate = jest.fn();
  MockModel.exists = jest.fn();
  return MockModel;
};

const createMockClubModel = () => {
  const MockModel = function () {};
  MockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn() });
  return MockModel;
};

const createMockPlayerModel = () => {
  const MockModel = function () {};
  MockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn() });
  return MockModel;
};

const mockAuditService = {
  audit: jest.fn(),
};

describe('UserProfilesService', () => {
  let service: UserProfilesService;
  let userProfileModel: ReturnType<typeof createMockUserProfileModel>;
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
    userProfileModel = createMockUserProfileModel();
    clubModel = createMockClubModel();
    playerModel = createMockPlayerModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfilesService,
        { provide: getModelToken('UserProfile'), useValue: userProfileModel },
        { provide: getModelToken('Club'), useValue: clubModel },
        { provide: getModelToken('Player'), useValue: playerModel },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UserProfilesService>(UserProfilesService);
    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('should return user profile when found', async () => {
      const mockProfile = { userId: 'user-1', role: Roles.CLUB };
      userProfileModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProfile),
      });

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(mockProfile);
    });

    it('should return null when profile not found', async () => {
      userProfileModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findByUserId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('upsertProfile', () => {
    it('should create profile for system admin', async () => {
      const dto = {
        userId: 'user-1',
        role: Roles.SYSTEM_ADMIN,
      };
      const mockProfile = { ...dto };
      userProfileModel.findOneAndUpdate.mockResolvedValue(mockProfile);

      const result = await service.upsertProfile(dto, adminContext);

      expect(result).toEqual(mockProfile);
      expect(mockAuditService.audit).toHaveBeenCalled();
    });

    it('should create profile for club role', async () => {
      const dto = {
        userId: 'user-1',
        role: Roles.CLUB,
        clubId: 'club-1',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      userProfileModel.findOneAndUpdate.mockResolvedValue(dto);

      const result = await service.upsertProfile(dto, adminContext);

      expect(result).toBeDefined();
      expect(mockAuditService.audit).toHaveBeenCalledTimes(2); // profile + moderator
    });

    it('should throw BadRequestException when clubId missing for club role', async () => {
      const dto = {
        userId: 'user-1',
        role: Roles.CLUB,
      };

      await expect(service.upsertProfile(dto, adminContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when club not found', async () => {
      const dto = {
        userId: 'user-1',
        role: Roles.CLUB,
        clubId: 'non-existent',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.upsertProfile(dto, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create profile for player role', async () => {
      const dto = {
        userId: 'user-1',
        role: Roles.PLAYER,
        clubId: 'club-1',
        playerId: 'player-1',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'player-1', clubId: 'club-1' }),
      });
      userProfileModel.findOneAndUpdate.mockResolvedValue(dto);

      const result = await service.upsertProfile(dto, adminContext);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when playerId missing for player role', async () => {
      const dto = {
        userId: 'user-1',
        role: Roles.PLAYER,
        clubId: 'club-1',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });

      await expect(service.upsertProfile(dto, adminContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when player not found', async () => {
      const dto = {
        userId: 'user-1',
        role: Roles.PLAYER,
        clubId: 'club-1',
        playerId: 'non-existent',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.upsertProfile(dto, adminContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when player belongs to different club', async () => {
      const dto = {
        userId: 'user-1',
        role: Roles.PLAYER,
        clubId: 'club-1',
        playerId: 'player-1',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'player-1', clubId: 'other-club' }),
      });

      await expect(service.upsertProfile(dto, adminContext)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('upsertSelfProfile', () => {
    it('should create self profile for club role', async () => {
      const dto = {
        role: Roles.CLUB,
        clubId: 'club-1',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      userProfileModel.findOneAndUpdate.mockResolvedValue({ userId: 'user-1', ...dto });

      const result = await service.upsertSelfProfile('user-1', dto, clubContext);

      expect(result).toBeDefined();
      expect(mockAuditService.audit).toHaveBeenCalled();
    });

    it('should throw BadRequestException for system_admin role', async () => {
      const dto = {
        role: Roles.SYSTEM_ADMIN,
        clubId: 'club-1',
      };

      await expect(
        service.upsertSelfProfile('user-1', dto, clubContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when club not found', async () => {
      const dto = {
        role: Roles.CLUB,
        clubId: 'non-existent',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.upsertSelfProfile('user-1', dto, clubContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate player when playerId provided', async () => {
      const dto = {
        role: Roles.PLAYER,
        clubId: 'club-1',
        playerId: 'player-1',
      };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'club-1' }),
      });
      playerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'player-1', clubId: 'club-1' }),
      });
      userProfileModel.findOneAndUpdate.mockResolvedValue({ userId: 'user-1', ...dto });

      const result = await service.upsertSelfProfile('user-1', dto, clubContext);

      expect(result).toBeDefined();
    });
  });

  describe('getProfileOrFail', () => {
    it('should return profile when found', async () => {
      const mockProfile = { userId: 'user-1', role: Roles.CLUB };
      userProfileModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProfile),
      });

      const result = await service.getProfileOrFail('user-1');

      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException when profile not found', async () => {
      userProfileModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getProfileOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hasAnyProfile', () => {
    it('should return true when profiles exist', async () => {
      userProfileModel.exists.mockResolvedValue({ _id: 'some-id' });

      const result = await service.hasAnyProfile();

      expect(result).toBe(true);
    });

    it('should return false when no profiles exist', async () => {
      userProfileModel.exists.mockResolvedValue(null);

      const result = await service.hasAnyProfile();

      expect(result).toBe(false);
    });
  });
});
