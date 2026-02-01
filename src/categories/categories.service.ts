import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Category } from './interfaces/category.interface';
import { CreateCategoryDto } from './dto/cretae-categorie.dto';
import { UpdateCategoryDto } from './dto/update-categorie.dt';
import { PlayersService } from '../players/players.service';
import { Club } from '../clubs/interfaces/club.interface';
import type { AccessContext } from '../auth/access-context.types';
import { Roles } from '../auth/roles';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListCategoriesQueryDto } from './dtos/list-categories.query';
import { PaginationQueryDto } from '../common/dtos/pagination-query.dto';
import { AuditService } from '../audit/audit.service';
import { AuditEvent } from '../audit/audit.events';
import { clampPagination } from '../common/pagination/pagination.util';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel('Category') private readonly categoryModel: Model<Category>,
    @InjectModel('Club') private readonly clubModel: Model<Club>,
    private readonly playersService: PlayersService,
    private readonly auditService: AuditService,
  ) {}

  async createCategory(
    createCategoryDto: CreateCategoryDto,
    context: AccessContext,
  ): Promise<Category> {
    const targetClubId = this.ensureClubScope(
      context,
      createCategoryDto.clubId,
    );
    const isDoubles = createCategoryDto.isDoubles ?? false;
    const { category } = createCategoryDto;
    const clubExists = await this.clubModel.findById(targetClubId).exec();
    if (!clubExists) {
      throw new NotFoundException(`Club with id ${targetClubId} not found`);
    }
    const categoryExists = await this.categoryModel
      .findOne({ category, clubId: targetClubId })
      .exec();
    if (categoryExists) {
      throw new BadRequestException(`Category ${category} already exists`);
    }

    const createdCategory = new this.categoryModel({
      ...createCategoryDto,
      clubId: targetClubId,
      isDoubles,
      // Make tenant explicit on writes; avoids relying on AsyncLocalStorage
      // propagation into Mongoose hooks during tests.
      tenant: context.tenantId ?? undefined,
    });
    const categoryCreated = await createdCategory.save();
    this.auditService.audit(AuditEvent.CATEGORY_CREATED, context, {
      targetIds: categoryCreated._id ? [categoryCreated._id.toString()] : [],
      clubId: targetClubId,
      category: categoryCreated.category,
    });
    return categoryCreated;
  }

  async getCategory(
    query: ListCategoriesQueryDto,
    context: AccessContext,
  ): Promise<PaginatedResult<Category>> {
    const filter: Record<string, unknown> = {};
    const scopedClubId =
      context.role === Roles.SYSTEM_ADMIN
        ? query.clubId
        : this.ensureClubScope(context);
    if (scopedClubId) {
      filter.clubId = scopedClubId;
    }
    if (query.q) {
      filter.category = this.buildSearchRegex(query.q);
    }

    const { page, limit, skip } = clampPagination(query);
    const baseQuery = this.categoryModel
      .find(filter as Record<string, never>)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('players');
    const [items, total] = await Promise.all([
      baseQuery.exec(),
      this.categoryModel.countDocuments(filter as Record<string, never>),
    ]);
    return {
      items: items.map((item) => this.ensureCategoryDefaults(item)),
      page,
      limit,
      total,
    };
  }

  async getCategoriesByPlayer(
    playerId: string | undefined,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<Category>> {
    if (!playerId) {
      throw new NotFoundException('Player profile not linked');
    }
    if (!Types.ObjectId.isValid(playerId)) {
      throw new BadRequestException('Invalid player identifier');
    }
    const playerObjectId = new Types.ObjectId(playerId);
    const { page, limit, skip } = clampPagination(pagination);
    const [items, total] = await Promise.all([
      this.categoryModel
        .find({ players: playerObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('players')
        .exec(),
      this.categoryModel.countDocuments({ players: playerObjectId }),
    ]);
    return {
      items: items.map((item) => this.ensureCategoryDefaults(item)),
      page,
      limit,
      total,
    };
  }

  async getCategoryById(
    category: string,
    context: AccessContext,
  ): Promise<Category> {
    const categoryFound = await this.categoryModel.findOne({ category }).exec();

    if (!categoryFound) {
      throw new NotFoundException(`Category ${category} not found`);
    }
    this.ensureCategoryAccess(categoryFound, context);
    return this.ensureCategoryDefaults(categoryFound);
  }

  async updateCategory(
    category: string,
    updateCategoryDto: UpdateCategoryDto,
    context: AccessContext,
  ): Promise<Category> {
    const categoryFound = await this.categoryModel.findOne({ category }).exec();

    if (!categoryFound) {
      throw new NotFoundException(`Category ${category} not found`);
    }
    this.ensureCategoryAccess(categoryFound, context);

    const updated = await this.categoryModel
      .findOneAndUpdate(
        { category },
        { $set: updateCategoryDto },
        { new: true },
      )
      .exec();
    const normalized = updated
      ? this.ensureCategoryDefaults(updated)
      : this.ensureCategoryDefaults(categoryFound);
    this.auditService.audit(AuditEvent.CATEGORY_UPDATED, context, {
      targetIds: [(updated?._id ?? categoryFound._id).toString()],
      category,
    });
    return normalized;
  }

  async assignPlayerCategory(
    category: string,
    playerId: string,
    context: AccessContext,
  ): Promise<void> {
    const categoryFound = await this.categoryModel.findOne({ category }).exec();
    if (!categoryFound) {
      throw new NotFoundException(`Category ${category} not found`);
    }
    this.ensureCategoryAccess(categoryFound, context);

    const playerAlreadyInCategory = await this.categoryModel
      .find({ category, clubId: categoryFound.clubId })
      .where('players')
      .in([playerId])
      .exec();
    const player = await this.playersService.getPlayerById(playerId, context);

    if (playerAlreadyInCategory.length > 0) {
      throw new BadRequestException(
        `Player ${playerId} already assigned to category ${category}`,
      );
    }

    if (String(categoryFound.clubId) !== String(player.clubId)) {
      throw new BadRequestException(
        `Player ${playerId} does not belong to category club`,
      );
    }

    // Avoid passing the full document back into $set (includes immutable tenant).
    await this.categoryModel
      .updateOne(
        { _id: categoryFound._id },
        { $addToSet: { players: playerId } },
      )
      .exec();
    this.auditService.audit(AuditEvent.CATEGORY_UPDATED, context, {
      targetIds: [categoryFound._id?.toString() ?? category],
      assignedPlayerId: playerId,
    });
  }

  private ensureClubScope(
    context: AccessContext,
    requestedClubId?: string,
  ): string {
    if (context.role === Roles.SYSTEM_ADMIN) {
      if (!requestedClubId) {
        throw new BadRequestException('clubId is required for this action');
      }
      return requestedClubId;
    }
    const clubId = context.clubId;
    if (!clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }
    if (requestedClubId && requestedClubId !== clubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }
    return clubId;
  }

  private ensureCategoryAccess(
    category: Category,
    context: AccessContext,
  ): void {
    if (context.role === Roles.SYSTEM_ADMIN) {
      return;
    }
    const clubId = context.clubId;
    if (!clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }
    if (String(category.clubId) !== clubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }
  }

  private buildSearchRegex(q: string): RegExp {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  }

  private ensureCategoryDefaults(category: Category): Category {
    if (category.isDoubles === undefined) {
      category.isDoubles = false;
    }
    return category;
  }
}
