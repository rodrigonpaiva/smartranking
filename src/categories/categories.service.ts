import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
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
      (player) => this.toIdString(player) === playerId,
    );
    if (!playerAlreadyInCategory) {
      throw new BadRequestException(
        `Player ${playerId} could not be assigned to category ${category}`,
      );
    }
  }

  private toIdString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeDoc = value as any;
    return maybeDoc?._id?.toString?.() ?? String(value);
  }
}
