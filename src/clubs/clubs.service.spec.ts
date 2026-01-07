import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/roles';
import type { AccessContext } from '../auth/access-context.types';

const createMockClubModel = () => {
  const MockModel = function (data: unknown) {
    return {
      ...data,
      _id: 'club-id',
      save: jest.fn().mockResolvedValue({ ...data, _id: 'club-id' }),
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
  MockModel.exists = jest.fn();
  return MockModel;
};

const mockAuditService = {
  audit: jest.fn(),
};

describe('ClubsService', () => {
  let service: ClubsService;
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
    clubModel = createMockClubModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubsService,
        { provide: getModelToken('Club'), useValue: clubModel },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ClubsService>(ClubsService);
    jest.clearAllMocks();
  });

  describe('createClub', () => {
    const createDto = {
      name: 'Test Club',
      slug: 'test-club',
    };

    it('should create a club successfully', async () => {
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createClub(createDto, adminContext);

      expect(result).toBeDefined();
      expect(mockAuditService.audit).toHaveBeenCalled();
    });

    it('should throw BadRequestException when slug already exists', async () => {
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ slug: 'test-club' }),
      });

      await expect(service.createClub(createDto, adminContext)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('registerClub', () => {
    const createDto = {
      name: 'New Club',
      slug: 'new-club',
    };

    it('should register a club successfully', async () => {
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.registerClub(createDto);

      expect(result).toHaveProperty('_id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('slug');
    });

    it('should throw BadRequestException for duplicate slug', async () => {
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ slug: 'new-club' }),
      });

      await expect(service.registerClub(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getAllClubs', () => {
    it('should return paginated clubs for admin', async () => {
      const mockClubs = [
        { name: 'Club 1', slug: 'club-1' },
        { name: 'Club 2', slug: 'club-2' },
      ];
      clubModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClubs),
      });
      clubModel.countDocuments.mockResolvedValue(2);

      const result = await service.getAllClubs(
        { page: 1, limit: 10 },
        adminContext,
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by search query for admin', async () => {
      clubModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      clubModel.countDocuments.mockResolvedValue(0);

      const result = await service.getAllClubs(
        { page: 1, limit: 10, q: 'search' },
        adminContext,
      );

      expect(result.items).toHaveLength(0);
    });

    it('should return only user club for club role', async () => {
      const mockClubs = [{ _id: 'club-1', name: 'My Club' }];
      clubModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClubs),
      });
      clubModel.countDocuments.mockResolvedValue(1);

      const result = await service.getAllClubs({ page: 1, limit: 10 }, clubContext);

      expect(result.items).toHaveLength(1);
    });

    it('should throw ForbiddenException when club user has no clubId', async () => {
      const contextWithoutClub: AccessContext = {
        userId: 'user',
        role: Roles.CLUB,
        tenantId: 'tenant-1',
      };

      await expect(
        service.getAllClubs({ page: 1, limit: 10 }, contextWithoutClub),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPublicClubs', () => {
    it('should return public club list', async () => {
      const mockClubs = [
        { _id: 'club-1', name: 'Club 1' },
        { _id: 'club-2', name: 'Club 2' },
      ];
      clubModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClubs),
      });
      clubModel.countDocuments.mockResolvedValue(2);

      const result = await service.getPublicClubs({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('getClubById', () => {
    it('should return club when found by admin', async () => {
      const mockClub = { _id: 'club-1', name: 'Test Club' };
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClub),
      });

      const result = await service.getClubById('club-1', adminContext);

      expect(result).toEqual(mockClub);
    });

    it('should return club for club user accessing own club', async () => {
      const mockClub = { _id: 'club-1', name: 'My Club' };
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClub),
      });

      const result = await service.getClubById('club-1', clubContext);

      expect(result).toEqual(mockClub);
    });

    it('should throw ForbiddenException for club user accessing other club', async () => {
      await expect(
        service.getClubById('other-club', clubContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when club not found', async () => {
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getClubById('non-existent', adminContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateClub', () => {
    it('should update club successfully', async () => {
      const mockClub = { _id: 'club-1', name: 'Old Name' };
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClub),
      });
      clubModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockClub, name: 'New Name' }),
      });

      const result = await service.updateClub(
        'club-1',
        { name: 'New Name' },
        adminContext,
      );

      expect(result.name).toBe('New Name');
      expect(mockAuditService.audit).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent club', async () => {
      clubModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateClub('non-existent', { name: 'Test' }, adminContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteClub', () => {
    it('should delete club successfully', async () => {
      const mockClub = { _id: 'club-1', name: 'Test Club' };
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClub),
      });
      clubModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      await service.deleteClub('club-1', adminContext);

      expect(mockAuditService.audit).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent club', async () => {
      clubModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.deleteClub('non-existent', adminContext),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
