import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateClubDto } from './dtos/create-club.dto';
import { UpdateClubDto } from './dtos/update-club.dto';
import { Club } from './interfaces/club.interface';
import type { AccessContext } from '../auth/access-context.types';
import { Roles } from '../auth/roles';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import type { ListClubsQueryDto } from './dtos/list-clubs.query';
import { PaginationQueryDto } from '../common/dtos/pagination-query.dto';
import { clampPagination } from '../common/pagination/pagination.util';
import { AuditService } from '../audit/audit.service';
import { AuditEvent } from '../audit/audit.events';
import { TenancyService } from '../tenancy/tenancy.service';

@Injectable()
export class ClubsService {
  constructor(
    @InjectModel('Club') private readonly clubModel: Model<Club>,
    private readonly auditService: AuditService,
    private readonly tenancyService: TenancyService,
  ) {}

  async createClub(
    createClubDto: CreateClubDto,
    context: AccessContext,
  ): Promise<Club> {
    // Club creation defines the tenant id as the club _id, so we must bypass
    // the current request tenant scoping when persisting the club itself.
    this.tenancyService.disableTenancyForCurrentScope();

    const existingClub = await this.clubModel
      .findOne({ slug: createClubDto.slug })
      .exec();
    if (existingClub) {
      throw new BadRequestException(
        `Club with slug ${createClubDto.slug} already exists`,
      );
    }
    const clubCreated = new this.clubModel(createClubDto);
    (clubCreated as unknown as { tenant?: string }).tenant = String(
      clubCreated._id,
    );
    const created = await clubCreated.save();
    const clubId = created._id?.toString();
    this.auditService.audit(AuditEvent.CLUB_CREATED, context, {
      targetIds: clubId ? [clubId] : [],
      slug: created.slug,
    });
    return created;
  }

  async registerClub(
    createClubDto: CreateClubDto,
  ): Promise<Pick<Club, '_id' | 'name' | 'slug'>> {
    // Public registration must also bypass the current tenant scoping because
    // the club document is the tenant root.
    this.tenancyService.disableTenancyForCurrentScope();

    const existingClub = await this.clubModel
      .findOne({ slug: createClubDto.slug })
      .exec();
    if (existingClub) {
      throw new BadRequestException(
        `Club with slug ${createClubDto.slug} already exists`,
      );
    }
    const clubCreated = new this.clubModel(createClubDto);
    (clubCreated as unknown as { tenant?: string }).tenant = String(
      clubCreated._id,
    );
    const created = await clubCreated.save();
    return {
      _id: created._id,
      name: created.name,
      slug: created.slug,
    };
  }

  async getAllClubs(
    query: ListClubsQueryDto,
    context: AccessContext,
  ): Promise<PaginatedResult<Club>> {
    const filter: Record<string, unknown> = {};
    if (context.role === Roles.SYSTEM_ADMIN) {
      if (query.q) {
        filter.$or = this.buildSearchFilter(query.q);
      }
    } else {
      if (!context.clubId) {
        throw new ForbiddenException('User is not assigned to a club');
      }
      filter._id = context.clubId;
    }

    const { page, limit, skip } = clampPagination(query);
    const findQuery = this.clubModel
      .find(filter as Record<string, never>)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const [items, total] = await Promise.all([
      findQuery.exec(),
      this.clubModel.countDocuments(filter as Record<string, never>),
    ]);
    return { items, page, limit, total };
  }

  async getPublicClubs(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Pick<Club, '_id' | 'name'>>> {
    const { page, limit, skip } = clampPagination(query);
    const [items, total] = await Promise.all([
      this.clubModel
        .find({}, { _id: 1, name: 1 })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.clubModel.countDocuments({}),
    ]);
    return { items, page, limit, total };
  }

  async getClubById(_id: string, context: AccessContext): Promise<Club> {
    if (context.role !== Roles.SYSTEM_ADMIN && context.clubId !== _id) {
      throw new ForbiddenException('Club not allowed for this user');
    }
    const clubFound = await this.clubModel.findOne({ _id }).exec();
    if (!clubFound) {
      throw new NotFoundException(`No clubs found with id: ${_id}`);
    }
    return clubFound;
  }

  async updateClub(
    _id: string,
    updateClub: UpdateClubDto,
    context: AccessContext,
  ): Promise<Club> {
    const clubExists = await this.clubModel.findById(_id).exec();
    if (!clubExists) {
      throw new NotFoundException(`Club with id ${_id} not found`);
    }
    const updated = await this.clubModel
      .findOneAndUpdate({ _id }, { $set: updateClub }, { new: true })
      .exec();
    const clubId = (updated?._id ?? _id)?.toString();
    this.auditService.audit(AuditEvent.CLUB_UPDATED, context, {
      targetIds: clubId ? [clubId] : [],
    });
    return updated as Club;
  }

  async deleteClub(_id: string, context: AccessContext): Promise<void> {
    const clubFound = await this.clubModel.findOne({ _id }).exec();
    if (!clubFound) {
      throw new NotFoundException(`No clubs found with id: ${_id}`);
    }
    await this.clubModel.deleteOne({ _id }).exec();
    this.auditService.audit(AuditEvent.CLUB_DELETED, context, {
      targetIds: [String(_id)],
    });
  }

  private buildSearchFilter(q: string): Array<Record<string, unknown>> {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    return [{ name: regex }, { slug: regex }];
  }
}
