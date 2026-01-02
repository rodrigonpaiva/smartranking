import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from './roles';
import type { AccessContext } from './access-context.types';

type RequestWithAccessContext = Request & {
  accessContext?: AccessContext | null;
  userProfile?: {
    role: UserRole;
  } | null;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithAccessContext>();
    const role = request.accessContext?.role ?? request.userProfile?.role;
    if (!role) {
      if (this.shouldBypassRoleCheck(request)) {
        return true;
      }
      throw new ForbiddenException('User role not available');
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException('User role not allowed');
    }

    return true;
  }

  private shouldBypassRoleCheck(request: RequestWithAccessContext): boolean {
    // Bootstrap bypass: allow authenticated users without a profile to
    // access only onboarding endpoints (`GET /users/me` and
    // `POST|PUT /users/profiles/self`). Any other route requires an
    // explicit role, preventing privilege escalation during onboarding.
    const hasProfile = Boolean(
      request.accessContext?.role ?? request.userProfile?.role,
    );
    if (hasProfile) {
      return false;
    }

    const method = (request.method ?? '').toUpperCase();
    const rawPath = (request.originalUrl ?? request.url ?? '').split('?')[0];
    const path = rawPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    const isUsersMe = method === 'GET' && path === '/api/v1/users/me';
    const isSelfProfile =
      (method === 'POST' || method === 'PUT') &&
      path === '/api/v1/users/profiles/self';

    return isUsersMe || isSelfProfile;
  }
}
