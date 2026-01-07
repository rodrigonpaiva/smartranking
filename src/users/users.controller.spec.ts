import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserProfilesService } from './users.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';
import type { Request } from 'express';
import type { UserProfile } from './interfaces/user-profile.interface';

type RequestWithProfile = Request & {
  accessContext?: AccessContext | null;
  user?: { id?: string; email?: string } | null;
  userProfile?: UserProfile | null;
  tenantId?: string | null;
};

const mockUserProfilesService = {
  upsertProfile: jest.fn(),
  upsertSelfProfile: jest.fn(),
  getProfileOrFail: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;
  let service: typeof mockUserProfilesService;

  const mockAccessContext: AccessContext = {
    userId: 'admin-1',
    role: Roles.SYSTEM_ADMIN,
    tenantId: 'tenant-1',
  };

  const mockClubContext: AccessContext = {
    userId: 'club-user-1',
    role: Roles.CLUB,
    clubId: 'club-1',
    tenantId: 'tenant-1',
  };

  const createMockRequest = (
    context?: AccessContext | null,
    user?: { id?: string; email?: string } | null,
    profile?: UserProfile | null,
  ): RequestWithProfile => {
    return {
      accessContext: context,
      user,
      userProfile: profile,
      tenantId: context?.tenantId ?? null,
    } as RequestWithProfile;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UserProfilesService, useValue: mockUserProfilesService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = mockUserProfilesService;

    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('should return current user info', () => {
      const mockProfile = {
        userId: 'user-1',
        role: Roles.CLUB,
        clubId: 'club-1',
      };
      const request = createMockRequest(
        mockClubContext,
        { id: 'user-1', email: 'user@test.com' },
        mockProfile as UserProfile,
      );

      const result = controller.getMe(request);

      expect(result).toEqual({
        id: 'user-1',
        email: 'user@test.com',
        role: Roles.CLUB,
        tenantId: 'tenant-1',
        profile: mockProfile,
      });
    });

    it('should return null values when user info missing', () => {
      const request = createMockRequest(mockClubContext, null, null);

      const result = controller.getMe(request);

      expect(result).toEqual({
        id: null,
        email: null,
        role: Roles.CLUB,
        tenantId: 'tenant-1',
        profile: null,
      });
    });

    it('should handle missing access context role', () => {
      const request = createMockRequest(null, { id: 'user-1' }, null);

      const result = controller.getMe(request);

      expect(result.role).toBeNull();
    });
  });

  describe('upsertProfile', () => {
    const createDto = {
      userId: 'user-1',
      role: Roles.CLUB,
      clubId: 'club-1',
    };

    it('should create user profile', async () => {
      const mockProfile = { ...createDto };
      service.upsertProfile.mockResolvedValue(mockProfile);

      const result = await controller.upsertProfile(
        createMockRequest(mockAccessContext),
        createDto,
      );

      expect(result).toEqual(mockProfile);
      expect(service.upsertProfile).toHaveBeenCalledWith(
        createDto,
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.upsertProfile(createMockRequest(null), createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('upsertSelfProfile', () => {
    const createDto = {
      role: Roles.CLUB,
      clubId: 'club-1',
    };

    it('should create self profile', async () => {
      const mockProfile = { userId: 'user-1', ...createDto };
      service.upsertSelfProfile.mockResolvedValue(mockProfile);
      const request = createMockRequest(
        mockClubContext,
        { id: 'user-1', email: 'user@test.com' },
        null,
      );

      const result = await controller.upsertSelfProfile(request, createDto);

      expect(result).toEqual(mockProfile);
      expect(service.upsertSelfProfile).toHaveBeenCalledWith(
        'user-1',
        createDto,
        mockClubContext,
      );
    });

    it('should throw UnauthorizedException when user id missing', async () => {
      const request = createMockRequest(mockClubContext, null, null);

      await expect(
        controller.upsertSelfProfile(request, createDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user object missing', async () => {
      const request = createMockRequest(mockClubContext, {}, null);

      await expect(
        controller.upsertSelfProfile(request, createDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when context missing', async () => {
      const request = createMockRequest(null, { id: 'user-1' }, null);

      await expect(
        controller.upsertSelfProfile(request, createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile by id', async () => {
      const mockProfile = { userId: 'user-1', role: Roles.CLUB };
      service.getProfileOrFail.mockResolvedValue(mockProfile);

      const result = await controller.getProfile('user-1');

      expect(result).toEqual(mockProfile);
      expect(service.getProfileOrFail).toHaveBeenCalledWith('user-1');
    });
  });
});
