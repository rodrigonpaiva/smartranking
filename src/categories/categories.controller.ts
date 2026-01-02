import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequireRoles } from '../auth/roles.decorator';
import { Roles } from '../auth/roles';
import { CreateCategoryDto } from './dto/cretae-categorie.dto';
import { CategoriesService } from './categories.service';
import { Category } from './interfaces/category.interface';
import { UpdateCategoryDto } from './dto/update-categorie.dt';
import { ValidationParamPipe } from '../common/pipes/validation-param.pipe';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import type { AccessContext } from '../auth/access-context.types';
import { ListCategoriesQueryDto } from './dtos/list-categories.query';
import { PaginationQueryDto } from '../common/dtos/pagination-query.dto';

type RequestWithContext = Request & { accessContext?: AccessContext | null };
@ApiTags('Categories')
@ApiCookieAuth('SessionCookie')
@ApiSecurity('Tenant')
@Controller('api/v1/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  private getAccessContext(req: Request): AccessContext {
    const context = (req as RequestWithContext).accessContext;
    if (!context) {
      throw new ForbiddenException('Access context missing');
    }
    return context;
  }

  @Post()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  @UsePipes(ValidationPipe)
  async createCategory(
    @Req() req: Request,
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    return await this.categoriesService.createCategory(
      createCategoryDto,
      this.getAccessContext(req),
    );
  }
  @Get()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getCategory(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListCategoriesQueryDto,
  ): Promise<Category[]> {
    const result = await this.categoriesService.getCategory(
      query,
      this.getAccessContext(req),
    );
    // Frontend contract expects a raw array for categories endpoints.
    return result.items;
  }

  @Get('my')
  @RequireRoles(Roles.PLAYER)
  async getMyCategories(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    pagination: PaginationQueryDto,
  ): Promise<Category[]> {
    const playerId = req.accessContext?.playerId;
    const result = await this.categoriesService.getCategoriesByPlayer(
      playerId,
      pagination,
    );
    return result.items;
  }

  @Get('/:category')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getCategorieById(
    @Param('category') category: string,
    @Req() req: Request,
  ): Promise<Category> {
    return await this.categoriesService.getCategoryById(
      category,
      this.getAccessContext(req),
    );
  }

  @Put('/:category')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  @UsePipes(ValidationPipe)
  async updateCategory(
    @Req() req: Request,
    @Body() updateCategory: UpdateCategoryDto,
    @Param('category') category: string,
  ): Promise<Category> {
    return await this.categoriesService.updateCategory(
      category,
      updateCategory,
      this.getAccessContext(req),
    );
  }

  @Post('/:category/players/:playerId')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async assignPlayerCategory(
    @Param('category', ValidationParamPipe) category: string,
    @Param('playerId', ParseMongoIdPipe) playerId: string,
    @Req() req: Request,
  ): Promise<void> {
    return await this.categoriesService.assignPlayerCategory(
      category,
      playerId,
      this.getAccessContext(req),
    );
  }
}
