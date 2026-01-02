import {
  Body,
  Controller,
  Delete,
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
import { Public } from '../auth/public.decorator';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dtos/create-club.dto';
import { UpdateClubDto } from './dtos/update-club.dto';
import { Club } from './interfaces/club.interface';
import type { AccessContext } from '../auth/access-context.types';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListClubsQueryDto } from './dtos/list-clubs.query';
import { PaginationQueryDto } from '../common/dtos/pagination-query.dto';

type RequestWithContext = Request & { accessContext?: AccessContext | null };

@ApiTags('Clubs')
@Controller('api/v1/clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  private getAccessContext(req: Request): AccessContext {
    const context = (req as RequestWithContext).accessContext;
    if (!context) {
      throw new ForbiddenException('Access context missing');
    }
    return context;
  }

  @Post()
  @ApiCookieAuth('SessionCookie')
  @ApiSecurity('Tenant')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  @UsePipes(ValidationPipe)
  async createClub(
    @Req() req: Request,
    @Body() createClubDto: CreateClubDto,
  ): Promise<Club> {
    return await this.clubsService.createClub(
      createClubDto,
      this.getAccessContext(req),
    );
  }

  @Get()
  @ApiCookieAuth('SessionCookie')
  @ApiSecurity('Tenant')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getAllClubs(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListClubsQueryDto,
  ): Promise<PaginatedResult<Club>> {
    return await this.clubsService.getAllClubs(
      query,
      this.getAccessContext(req),
    );
  }

  @Get('public')
  @Public()
  async getPublicClubs(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Pick<Club, '_id' | 'name'>>> {
    return await this.clubsService.getPublicClubs(query);
  }

  @Get(':_id')
  @ApiCookieAuth('SessionCookie')
  @ApiSecurity('Tenant')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB)
  async getClubById(
    @Param('_id', ParseMongoIdPipe) _id: string,
    @Req() req: Request,
  ): Promise<Club> {
    return await this.clubsService.getClubById(_id, this.getAccessContext(req));
  }

  @Put(':_id')
  @ApiCookieAuth('SessionCookie')
  @ApiSecurity('Tenant')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  @UsePipes(ValidationPipe)
  async updateClub(
    @Req() req: Request,
    @Body() updateClubDto: UpdateClubDto,
    @Param('_id', ParseMongoIdPipe) _id: string,
  ): Promise<Club> {
    return await this.clubsService.updateClub(
      _id,
      updateClubDto,
      this.getAccessContext(req),
    );
  }

  @Delete(':_id')
  @ApiCookieAuth('SessionCookie')
  @ApiSecurity('Tenant')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  async deleteClub(
    @Req() req: Request,
    @Param('_id', ParseMongoIdPipe) _id: string,
  ): Promise<void> {
    await this.clubsService.deleteClub(_id, this.getAccessContext(req));
  }
}
