import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RequireRoles } from '../auth/roles.decorator';
import { Roles } from '../auth/roles';
import { Public } from '../auth/public.decorator';
import { ValidationParamPipe } from '../common/pipes/validation-param.pipe';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dtos/create-club.dto';
import { UpdateClubDto } from './dtos/update-club.dto';
import { Club } from './interfaces/club.interface';

@Controller('api/v1/clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  @RequireRoles(Roles.SYSTEM_ADMIN)
  @UsePipes(ValidationPipe)
  async createClub(@Body() createClubDto: CreateClubDto): Promise<Club> {
    return await this.clubsService.createClub(createClubDto);
  }

  @Get()
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getAllClubs(): Promise<Club[]> {
    return await this.clubsService.getAllClubs();
  }

  @Get('public')
  @Public()
  async getPublicClubs(): Promise<Array<Pick<Club, '_id' | 'name'>>> {
    return await this.clubsService.getPublicClubs();
  }

  @Get(':_id')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getClubById(
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<Club> {
    return await this.clubsService.getClubById(_id);
  }

  @Put(':_id')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  @UsePipes(ValidationPipe)
  async updateClub(
    @Body() updateClubDto: UpdateClubDto,
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<Club> {
    return await this.clubsService.updateClub(_id, updateClubDto);
  }

  @Delete(':_id')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  async deleteClub(
    @Param('_id', ValidationParamPipe) _id: string,
  ): Promise<void> {
    await this.clubsService.deleteClub(_id);
  }
}
