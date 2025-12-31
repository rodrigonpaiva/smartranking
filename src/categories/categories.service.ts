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
import { Club } from '../clubs/interfaces/club.interface';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel('Category') private readonly categoryModel: Model<Category>,
    @InjectModel('Club') private readonly clubModel: Model<Club>,
    private readonly playersService: PlayersService,
  ) {}

  async createCategory(
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    const { category, clubId } = createCategoryDto;
    const clubExists = await this.clubModel.findById(clubId).exec();
    if (!clubExists) {
      throw new NotFoundException(`Club with id ${clubId} not found`);
    }
    const categoryExists = await this.categoryModel
      .findOne({ category, clubId })
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

  async getCategoriesByPlayer(playerId?: string): Promise<Array<Category>> {
    if (!playerId) {
      throw new NotFoundException('Player profile not linked');
    }
    return await this.categoryModel
      .find({ players: playerId } as unknown as Record<string, unknown>)
      .populate('players')
      .exec();
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
  ): Promise<Category> {
    const categoryFound = await this.categoryModel.findOne({ category }).exec();

    if (!categoryFound) {
      throw new NotFoundException(`Category ${category} not found`);
    }

    const updated = await this.categoryModel
      .findOneAndUpdate({ category }, { $set: updateCategoryDto }, { new: true })
      .exec();
    return updated as Category;
  }

  async assignPlayerCategory(params: string[]): Promise<void> {
    const category = params['category'];
    const playerId = params['playerId'];

    const categoryFound = await this.categoryModel.findOne({ category }).exec();
    const playerAlreadyInCategory = await this.categoryModel
      .find({ category, clubId: categoryFound?.clubId })
      .where('players')
      .in(playerId)
      .exec();
    const player = await this.playersService.getPlayerById(playerId);

    if (!categoryFound) {
      throw new NotFoundException(`Category ${category} not found`);
    }

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

    categoryFound.players.push(playerId);
    await this.categoryModel
      .findOneAndUpdate({ category }, { $set: categoryFound })
      .exec();
  }
}
