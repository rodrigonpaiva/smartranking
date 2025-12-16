import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { Category } from './interfaces/category.interface';
import { CreateCategoryDto } from './dto/cretae-categorie.dto';
import { InjectModel } from '@nestjs/mongoose';
import { UpdateCategoryDto } from './dto/update-categorie.dt';
import { PlayersService } from '../players/players.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel('Category') private readonly categoryModel: Model<Category>,
    private readonly playersService: PlayersService,
  ) {}

  async createCategory(
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    const { category } = createCategoryDto;
    const categoryExists = await this.categoryModel
      .findOne({ category })
      .exec();
    if (categoryExists) {
      throw new BadRequestException(`Category ${category} already exists`);
    }

    const createdCategory = new this.categoryModel(createCategoryDto);
    return await createdCategory.save();
  }

  async getCategory(): Promise<Array<Category>> {
    return await this.categoryModel.find().populate('players').exec();
  }

  async getCategoryById(category: string): Promise<Category> {
    const categoryFound = await this.categoryModel.findOne({ category }).exec();

    if (!categoryFound) {
      throw new NotFoundException(`Category ${category} not found`);
    }
    return categoryFound;
  }

  async updateCategory(
    category: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<void> {
    const categoryFound = await this.categoryModel.findOne({ category }).exec();

    if (!categoryFound) {
      throw new NotFoundException(`Category ${category} not found`);
    }

    await this.categoryModel
      .findOneAndUpdate({ category }, { $set: updateCategoryDto })
      .exec();
  }

  async assignPlayerCategory(params: string[]): Promise<void> {
    const category = params['category'];
    const playerId = params['playerId'];

    const categoryFound = await this.categoryModel.findOne({ category }).exec();
    const playerAlreadyInCategory = await this.categoryModel
      .find({ category })
      .where('players')
      .in(playerId)
      .exec();
    await this.playersService.getPlayerById(playerId);

    if (!categoryFound) {
      throw new NotFoundException(`Category ${category} not found`);
    }

    if (playerAlreadyInCategory.length > 0) {
      throw new BadRequestException(
        `Player ${playerId} already assigned to category ${category}`,
      );
    }

    categoryFound.players.push(playerId);
    await this.categoryModel
      .findOneAndUpdate({ category }, { $set: categoryFound })
      .exec();
  }
}
