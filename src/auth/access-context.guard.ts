import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TenancyService } from '../tenancy/tenancy.service';
import {
  TENANCY_HEADER_NAME,
  TENANCY_HEADER_PATTERN,
} from '../tenancy/tenancy.constants';
import { UserProfilesService } from '../users/users.service';
import { Roles, UserRole } from './roles';
import { PUBLIC_KEY } from './public.decorator';
import type { AccessContext } from './access-context.types';
import { RequestContextService } from '../common/logger/request-context.service';

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
    private readonly requestContext: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.id) {
      this.requestContext.merge({ userId: request.user.id });
    }
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

    const shouldApplyTenant = await this.ensureProfileOrAllow(request);
    if (!shouldApplyTenant) {
      return true;
    }

    if (this.isMeRequest(request)) {
      return true;
    }

    this.applyTenantRules(request);
    return true;
  }

  private async ensureProfileOrAllow(
    request: RequestWithUser,
  ): Promise<boolean> {
    if (request.userProfile) {
      this.attachAccessContext(request, request.userProfile);
      return true;
    }

    const profile = await this.userProfilesService.findByUserId(
      request.user!.id as string,
    );

    if (!profile) {
      if (this.isMeRequest(request)) {
        request.userProfile = null;
        request.accessContext = null;
        return false;
      }
      const canBootstrap = await this.canBootstrapProfile(request);
      if (canBootstrap) {
        this.attachBootstrapAccessContext(request);
        return false;
      }
      throw new ForbiddenException('User profile not configured');
    }

    request.userProfile = profile;
    this.attachAccessContext(request, profile);
    return true;
  }

  private attachAccessContext(
    request: RequestWithUser,
    profile: NonNullable<RequestWithUser['userProfile']>,
  ): void {
    const userId = request.user?.id;
    if (!userId) {
      request.accessContext = null;
      return;
    }
    const context: AccessContext = {
      userId,
      role: profile.role,
      tenantId: request.tenantId ?? null,
      clubId: profile.clubId ? String(profile.clubId) : undefined,
      playerId: profile.playerId ? String(profile.playerId) : undefined,
    };
    request.accessContext = context;
    this.requestContext.registerAccessContext(context);
  }

  private applyTenantRules(request: RequestWithUser): void {
    const profile = request.userProfile;
    if (!profile) return;

    if (profile.role === Roles.SYSTEM_ADMIN) {
      const tenant = this.resolveTenantForAdmin(request);
      this.activateTenant(request, tenant);
      return;
    }

    if (!profile.clubId) {
      throw new ForbiddenException('User is not assigned to a club');
    }

    const tenantFromHeader = this.requireTenantHeader(request);
    const normalizedClubId = String(profile.clubId);
    if (tenantFromHeader !== normalizedClubId) {
      throw new ForbiddenException('Tenant not allowed for this user');
    }

    const clubId = this.extractClubId(request);
    if (clubId && clubId !== normalizedClubId) {
      throw new ForbiddenException('Club not allowed for this user');
    }

    this.activateTenant(request, normalizedClubId);
  }

  private resolveTenantForAdmin(request: RequestWithUser): string {
    const headerTenant = this.extractTenantFromHeaders(request);
    const normalizedHeader = this.normalizeTenant(headerTenant);
    if (normalizedHeader) {
      return normalizedHeader;
    }
    const fallback = this.extractClubId(request);
    if (fallback) {
      return fallback;
    }
    throw new BadRequestException('Tenant header is required');
  }

  private requireTenantHeader(request: RequestWithUser): string {
    const tenant = this.normalizeTenant(this.extractTenantFromHeaders(request));
    if (!tenant) {
      throw new BadRequestException('Tenant header is required');
    }
    return tenant;
  }

  private extractTenantFromHeaders(
    request: RequestWithUser,
  ): string | undefined {
    const headerValue = request.headers?.[TENANCY_HEADER_NAME];
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }
    if (typeof headerValue === 'string') {
      return headerValue;
    }
    return undefined;
  }

  private normalizeTenant(rawTenant?: string): string | undefined {
    if (!rawTenant) {
      return undefined;
    }
    const trimmed = rawTenant.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!TENANCY_HEADER_PATTERN.test(trimmed)) {
      throw new BadRequestException('Tenant header is invalid');
    }
    return trimmed;
  }

  private activateTenant(request: RequestWithUser, tenant: string): void {
    this.tenancyService.setTenant(tenant);
    request.tenantId = tenant;
    this.requestContext.setTenant(tenant);
    if (request.accessContext) {
      request.accessContext.tenantId = tenant;
      this.requestContext.registerAccessContext(request.accessContext);
    }
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
    const isSelfProfileRequest = url.includes('/api/v1/users/profiles/self');
    if (isSelfProfileRequest) {
      return true;
    }
    const hasAnyProfile = await this.userProfilesService.hasAnyProfile();
    if (hasAnyProfile) return false;
    const body = this.asRecord(request.body);
    const requestedUserId = this.getStringField(body, 'userId');
    const requestedRole = this.getStringField(body, 'role');
    if (requestedUserId !== request.user?.id) return false;
    if (requestedRole !== Roles.SYSTEM_ADMIN) return false;
    return true;
  }

  private attachBootstrapAccessContext(request: RequestWithUser): void {
    request.userProfile = null;
    const userId = request.user?.id;
    if (!userId) {
      request.accessContext = null;
      return;
    }
    const body = this.asRecord(request.body);
    const role = this.getStringField(body, 'role') as UserRole | undefined;
    const clubId = this.getStringField(body, 'clubId');
    const playerId = this.getStringField(body, 'playerId');
    if (!role) {
      request.accessContext = null;
      return;
    }
    const context: AccessContext = {
      userId,
      role,
      tenantId: request.tenantId ?? null,
      clubId,
      playerId,
    };
    request.accessContext = context;
    this.requestContext.registerAccessContext(context);
    if (clubId) {
      this.activateTenant(request, clubId);
    }
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
