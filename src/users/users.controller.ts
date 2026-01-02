import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequireRoles } from '../auth/roles.decorator';
import { Roles } from '../auth/roles';
import { CreateUserProfileDto } from './dtos/create-user-profile.dto';
import { CreateSelfProfileDto } from './dtos/create-self-profile.dto';
import { UserProfilesService } from './users.service';
import type { UserProfile } from './interfaces/user-profile.interface';
import type { UserRole } from '../auth/roles';
import { Throttle } from '@nestjs/throttler';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import type { AccessContext } from '../auth/access-context.types';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';

interface GetMeResponse {
  id: string | null;
  email: string | null;
  role: UserRole | null;
  tenantId: string | null;
  profile: UserProfile | null;
}

type RequestWithProfile = Request & {
  accessContext?: { role: UserRole; tenantId?: string | null } | null;
  user?: { id?: string; email?: string } | null;
  userProfile?: UserProfile | null;
  tenantId?: string | null;
};

@ApiTags('Users')
@ApiCookieAuth('SessionCookie')
@ApiSecurity('Tenant')
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly userProfilesService: UserProfilesService) {}

  private getAccessContext(req: Request): AccessContext {
    const context = (req as RequestWithProfile).accessContext;
    if (!context) {
      throw new ForbiddenException('Access context missing');
    }
    return context;
  }

  @Get('me')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER)
  @UseInterceptors(NoCacheInterceptor)
  getMe(@Req() req: Request): GetMeResponse {
    const typed = req as RequestWithProfile;
    const user = typed.user ?? null;
    const profile = typed.userProfile ?? null;
    const role: UserRole | null = typed.accessContext?.role ?? null;

    if (user && !profile) {
      throw new ForbiddenException('User profile not configured');
    }

    return {
      id: user?.id ?? null,
      email: user?.email ?? null,
      role,
      tenantId: typed.accessContext?.tenantId ?? typed.tenantId ?? null,
      profile,
    };
  }

  @Post('profiles')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  @UsePipes(ValidationPipe)
  @Throttle({ default: { limit: 20, ttl: 60 } })
  async upsertProfile(@Req() req: Request, @Body() dto: CreateUserProfileDto) {
    return await this.userProfilesService.upsertProfile(
      dto,
      this.getAccessContext(req),
    );
  }

  @Post('profiles/self')
  @RequireRoles(Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER)
  @UsePipes(ValidationPipe)
  @Throttle({ default: { limit: 20, ttl: 60 } })
  async upsertSelfProfile(
    @Req() req: Request,
    @Body() dto: CreateSelfProfileDto,
  ) {
    const userId = (req as RequestWithProfile).user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return await this.userProfilesService.upsertSelfProfile(
      userId,
      dto,
      this.getAccessContext(req),
    );
  }

  @Get('profiles/:userId')
  @RequireRoles(Roles.SYSTEM_ADMIN)
  async getProfile(@Param('userId', ParseMongoIdPipe) userId: string) {
    return await this.userProfilesService.getProfileOrFail(userId);
  }
}
