import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { OptionalAuth } from '@thallesp/nestjs-better-auth';
import { RequireRoles } from '../auth/roles.decorator';
import { Roles } from '../auth/roles';
import { Public } from '../auth/public.decorator';
import { CreateUserProfileDto } from './dtos/create-user-profile.dto';
import { CreateSelfProfileDto } from './dtos/create-self-profile.dto';
import { UserProfilesService } from './users.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly userProfilesService: UserProfilesService) {}

  @Get('me')
  @OptionalAuth()
  getMe(@Req() req: Request & { user?: unknown; userProfile?: unknown }) {
    return {
      user: req.user ?? null,
      profile: req.userProfile ?? null,
    };
  }

  @Post('profiles')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  @UsePipes(ValidationPipe)
  async upsertProfile(@Body() dto: CreateUserProfileDto) {
    return await this.userProfilesService.upsertProfile(dto);
  }

  @Post('profiles/self')
  @Public()
  @UsePipes(ValidationPipe)
  async upsertSelfProfile(
    @Req() req: Request & { user?: { id?: string } | null },
    @Body() dto: CreateSelfProfileDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return await this.userProfilesService.upsertSelfProfile(userId, dto);
  }

  @Get('profiles/:userId')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  async getProfile(@Param('userId') userId: string) {
    return await this.userProfilesService.getProfileOrFail(userId);
  }
}
