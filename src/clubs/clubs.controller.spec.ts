import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';
import type { Request } from 'express';

type RequestWithContext = Request & { accessContext?: AccessContext | null };

const mockClubsService = {
  createClub: jest.fn(),
  getAllClubs: jest.fn(),
  getPublicClubs: jest.fn(),
  registerClub: jest.fn(),
  getClubById: jest.fn(),
  updateClub: jest.fn(),
  deleteClub: jest.fn(),
};

describe('ClubsController', () => {
  let controller: ClubsController;
  let service: typeof mockClubsService;

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
  ): RequestWithContext => {
    return {
      accessContext: context,
    } as RequestWithContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClubsController],
      providers: [
        { provide: ClubsService, useValue: mockClubsService },
      ],
    }).compile();

    controller = module.get<ClubsController>(ClubsController);
    service = mockClubsService;

    jest.clearAllMocks();
  });

  describe('createClub', () => {
    const createDto = {
      name: 'Test Club',
      slug: 'test-club',
    };

    it('should create a club', async () => {
      const mockClub = { _id: 'club-1', ...createDto };
      service.createClub.mockResolvedValue(mockClub);

      const result = await controller.createClub(
        createMockRequest(mockAccessContext),
        createDto,
      );

      expect(result).toEqual(mockClub);
      expect(service.createClub).toHaveBeenCalledWith(
        createDto,
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.createClub(createMockRequest(null), createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAllClubs', () => {
    it('should return paginated clubs for admin', async () => {
      const mockResult = {
        items: [{ name: 'Club 1' }, { name: 'Club 2' }],
        total: 2,
        page: 1,
        limit: 10,
      };
      service.getAllClubs.mockResolvedValue(mockResult);

      const result = await controller.getAllClubs(
        createMockRequest(mockAccessContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockResult);
    });

    it('should return user club for club role', async () => {
      const mockResult = {
        items: [{ _id: 'club-1', name: 'My Club' }],
        total: 1,
        page: 1,
        limit: 10,
      };
      service.getAllClubs.mockResolvedValue(mockResult);

      const result = await controller.getAllClubs(
        createMockRequest(mockClubContext),
        { page: 1, limit: 10 },
      );

      expect(result).toEqual(mockResult);
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getAllClubs(createMockRequest(null), { page: 1, limit: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPublicClubs', () => {
    it('should return public club list', async () => {
      const mockResult = {
        items: [
          { _id: 'club-1', name: 'Club 1' },
          { _id: 'club-2', name: 'Club 2' },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };
      service.getPublicClubs.mockResolvedValue(mockResult);

      const result = await controller.getPublicClubs({ page: 1, limit: 10 });

      expect(result).toEqual(mockResult);
      expect(service.getPublicClubs).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });
  });

  describe('registerClub', () => {
    const createDto = {
      name: 'New Club',
      slug: 'new-club',
    };

    it('should register a new club', async () => {
      const mockResult = {
        _id: 'club-1',
        name: 'New Club',
        slug: 'new-club',
      };
      service.registerClub.mockResolvedValue(mockResult);

      const result = await controller.registerClub(createDto);

      expect(result).toEqual(mockResult);
      expect(service.registerClub).toHaveBeenCalledWith(createDto);
    });
  });

  describe('getClubById', () => {
    it('should return club by id for admin', async () => {
      const mockClub = { _id: 'club-1', name: 'Test Club' };
      service.getClubById.mockResolvedValue(mockClub);

      const result = await controller.getClubById(
        'club-1',
        createMockRequest(mockAccessContext),
      );

      expect(result).toEqual(mockClub);
      expect(service.getClubById).toHaveBeenCalledWith(
        'club-1',
        mockAccessContext,
      );
    });

    it('should return own club for club role', async () => {
      const mockClub = { _id: 'club-1', name: 'My Club' };
      service.getClubById.mockResolvedValue(mockClub);

      const result = await controller.getClubById(
        'club-1',
        createMockRequest(mockClubContext),
      );

      expect(result).toEqual(mockClub);
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.getClubById('club-1', createMockRequest(null)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateClub', () => {
    const updateDto = { name: 'Updated Club Name' };

    it('should update club', async () => {
      const mockClub = { _id: 'club-1', ...updateDto };
      service.updateClub.mockResolvedValue(mockClub);

      const result = await controller.updateClub(
        createMockRequest(mockAccessContext),
        updateDto,
        'club-1',
      );

      expect(result).toEqual(mockClub);
      expect(service.updateClub).toHaveBeenCalledWith(
        'club-1',
        updateDto,
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.updateClub(createMockRequest(null), updateDto, 'club-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteClub', () => {
    it('should delete club', async () => {
      service.deleteClub.mockResolvedValue(undefined);

      await controller.deleteClub(
        createMockRequest(mockAccessContext),
        'club-1',
      );

      expect(service.deleteClub).toHaveBeenCalledWith(
        'club-1',
        mockAccessContext,
      );
    });

    it('should throw ForbiddenException when context missing', async () => {
      await expect(
        controller.deleteClub(createMockRequest(null), 'club-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
