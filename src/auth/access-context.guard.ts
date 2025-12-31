import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TenancyService } from '../tenancy/tenancy.service';
import { UserProfilesService } from '../users/users.service';
import { Roles, UserRole } from './roles';
import { PUBLIC_KEY } from './public.decorator';

type RequestWithUser = Request & {
  user?: { id?: string } | null;
  userProfile?: {
    userId: string;
    role: UserRole;
    clubId?: string;
    playerId?: string;
  } | null;
};

const OPTIONAL_KEY = 'OPTIONAL';

@Injectable()
export class AccessContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userProfilesService: UserProfilesService,
    private readonly tenancyService: TenancyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (!request.user && (isPublic || isOptional)) {
      return true;
    }

    if (!request.user?.id) {
      throw new UnauthorizedException();
    }

    if (!request.userProfile) {
      const profile = await this.userProfilesService.findByUserId(
        request.user.id,
      );
      if (!profile) {
        if (this.isMeRequest(request)) {
          request.userProfile = null;
          return true;
        }
        const canBootstrap = await this.canBootstrapProfile(request);
        if (canBootstrap) {
          return true;
        }
        throw new ForbiddenException('User profile not configured');
      }
      request.userProfile = profile;
    }

    this.applyTenantRules(request);
    return true;
  }

  private applyTenantRules(request: RequestWithUser): void {
    const profile = request.userProfile;
    if (!profile) return;

    if (profile.role === Roles.SYSTEM_ADMIN) {
      const explicitTenant = this.extractTenant(request);
      if (explicitTenant) {
        this.tenancyService.setTenant(explicitTenant);
        return;
      }

      if (
        request.method === 'GET' &&
        !explicitTenant &&
        !this.extractClubId(request)
      ) {
        this.tenancyService.disableTenancyForCurrentScope();
        return;
      }

      const clubId = this.extractClubId(request);
      if (clubId) {
        this.tenancyService.setTenant(clubId);
      }
      return;
    }

    if (!profile.clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }

    const headerTenant = this.extractTenant(request);
    if (headerTenant && headerTenant !== profile.clubId) {
      throw new ForbiddenException('Tenant not allowed for this user');
    }

    const clubId = this.extractClubId(request);
    if (clubId && clubId !== profile.clubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }

    this.tenancyService.setTenant(profile.clubId);
  }

  private extractTenant(request: RequestWithUser): string | undefined {
    const headerTenant = request.headers?.['x-tenant-id'];
    if (typeof headerTenant === 'string' && headerTenant.length > 0) {
      return headerTenant;
    }
    const queryTenant = this.getStringField(
      this.asRecord(request.query),
      'tenant',
    );
    return queryTenant || undefined;
  }

  private extractClubId(request: RequestWithUser): string | undefined {
    const bodyClubId = this.getStringField(
      this.asRecord(request.body),
      'clubId',
    );
    if (bodyClubId) return bodyClubId;
    const paramClubId = this.getStringField(
      this.asRecord(request.params),
      'clubId',
    );
    if (paramClubId) return paramClubId;
    const queryClubId = this.getStringField(
      this.asRecord(request.query),
      'clubId',
    );
    if (queryClubId) return queryClubId;
    return undefined;
  }

  private async canBootstrapProfile(
    request: RequestWithUser,
  ): Promise<boolean> {
    if (request.method !== 'POST') return false;
    const url = request.originalUrl ?? '';
    if (!url.includes('/api/v1/users/profiles')) return false;
    const hasAnyProfile = await this.userProfilesService.hasAnyProfile();
    if (hasAnyProfile) return false;
    const body = this.asRecord(request.body);
    const requestedUserId = this.getStringField(body, 'userId');
    const requestedRole = this.getStringField(body, 'role');
    if (requestedUserId !== request.user?.id) return false;
    if (requestedRole !== Roles.SYSTEM_ADMIN) return false;
    return true;
  }

  private isMeRequest(request: RequestWithUser): boolean {
    if (request.method !== 'GET') return false;
    const url = request.originalUrl ?? '';
    return url.includes('/api/v1/users/me');
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private getStringField(
    record: Record<string, unknown> | null,
    key: string,
  ): string | undefined {
    if (!record) return undefined;
    const fieldValue = record[key];
    return typeof fieldValue === 'string' && fieldValue.length > 0
      ? fieldValue
      : undefined;
  }
}
