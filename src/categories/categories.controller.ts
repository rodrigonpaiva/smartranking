import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { RequireRoles } from '../auth/roles.decorator';
import { Roles } from '../auth/roles';
import { CreateCategoryDto } from './dto/cretae-categorie.dto';
import { CategoriesService } from './categories.service';
import { Category } from './interfaces/category.interface';
import { UpdateCategoryDto } from './dto/update-categorie.dt';
import { ValidationParamPipe } from '../common/pipes/validation-param.pipe';

@Controller('api/v1/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  @UsePipes(ValidationPipe)
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    return await this.categoriesService.createCategory(createCategoryDto);
  }
  @Get()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getCategory(): Promise<Array<Category>> {
    return await this.categoriesService.getCategory();
  }

  @Get('my')
  @RequireRoles(Roles.PLAYER)
  async getMyCategories(
    @Req() req: Request & { userProfile?: { playerId?: string } },
  ) {
    const playerId = req.userProfile?.playerId;
    return await this.categoriesService.getCategoriesByPlayer(playerId);
  }

  @Get('/:category')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getCategorieById(
    @Param('category') category: string,
  ): Promise<Category> {
    return await this.categoriesService.getCategoryById(category);
  }

  @Put('/:category')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  @UsePipes(ValidationPipe)
  async updateCategory(
    @Body() updateCategory: UpdateCategoryDto,
    @Param('category') category: string,
  ): Promise<Category> {
    return await this.categoriesService.updateCategory(
      category,
      updateCategory,
    );
  }

  @Post('/:category/players/:playerId')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async assignPlayerCategory(
    @Param('category', ValidationParamPipe) category: string,
    @Param('playerId', ValidationParamPipe) playerId: string,
  ): Promise<void> {
    return await this.categoriesService.assignPlayerCategory({
      category,
      playerId,
    });
  }
}
