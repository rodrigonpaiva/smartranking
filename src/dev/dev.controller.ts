import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { auth } from '../auth/auth';
import { Public } from '../auth/public.decorator';
import { StructuredLoggerService } from '../common/logger/logger.service';

type AuthUserLookupResponse = {
  exists: boolean;
  userId?: string;
  email?: string;
  createdAt?: string;
};

@Controller('api/dev')
export class DevController {
  constructor(private readonly logger: StructuredLoggerService) {}

  @Get('auth-user')
  @Public()
  async getAuthUser(
    @Query('email') email: string | undefined,
    @Req() req: Request,
  ): Promise<AuthUserLookupResponse> {
    if (!this.isDevEnabled()) {
      throw new NotFoundException();
    }
    const normalized = (email ?? '').trim();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException('email query param is required');
    }

    const context = await auth.$context;
    const record = await context.internalAdapter.findUserByEmail(normalized);
    const user = record?.user;
    const exists = Boolean(user?.id);
    this.logger.log('dev.auth-user.lookup', {
      requestId: req.requestId ?? null,
      email: normalized,
      exists,
    });

    if (!user?.id) {
      return { exists: false };
    }

    return {
      exists: true,
      userId: user.id,
      email: user.email,
      createdAt: user.createdAt
        ? new Date(user.createdAt).toISOString()
        : undefined,
    };
  }

  private isDevEnabled(): boolean {
    const isProduction = process.env.NODE_ENV === 'production';
    const debugFlag = process.env.DEV_DEBUG_AUTH === 'true';
    return !isProduction || debugFlag;
  }
}
