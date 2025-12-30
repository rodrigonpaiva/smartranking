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
import { toIdString } from '../common/utils/mongoose.util';

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
    return categoryFound.populate('players');
  }

  async getCategoryByPlayer(playerId: string): Promise<Category> {
    await this.playersService.getPlayerById(playerId);

    const category = await this.categoryModel
      .findOne()
      .where('players')
      .in([playerId])
      .exec();

    if (!category) {
      throw new NotFoundException(
        `No category found for player with id ${playerId}`,
      );
    }

    return category;
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

  async assignPlayerCategory(params: {
    category: string;
    playerId: string;
  }): Promise<void> {
    const { category, playerId } = params;

    await this.playersService.getPlayerById(playerId);

    const alreadyAssigned = await this.categoryModel
      .findOne({ category, players: { $in: [playerId] } })
      .exec();
    if (alreadyAssigned) {
      throw new BadRequestException(
        `Player ${playerId} already assigned to category ${category}`,
      );
    }

    const updatedCategory = await this.categoryModel
      .findOneAndUpdate(
        { category },
        { $addToSet: { players: playerId } },
        { new: true },
      )
      .exec();

    if (!updatedCategory) {
      throw new NotFoundException(`Category ${category} not found`);
    }

    const playerAlreadyInCategory = updatedCategory.players.some(
      (player) => toIdString(player) === playerId,
    );
    if (!playerAlreadyInCategory) {
      throw new BadRequestException(
        `Player ${playerId} could not be assigned to category ${category}`,
      );
    }
  }

  async deleteCategory(category: string): Promise<void> {
    const { deletedCount } = await this.categoryModel
      .deleteOne({ category })
      .exec();

    if (!deletedCount) {
      throw new NotFoundException(`Category ${category} not found`);
    }
  }
}
