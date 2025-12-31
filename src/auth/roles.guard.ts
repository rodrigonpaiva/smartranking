import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './roles';

type RequestWithProfile = Request & {
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

    const request = context.switchToHttp().getRequest<RequestWithProfile>();
    const role = request.userProfile?.role;
    if (!role) {
      if (this.isBootstrapRequest(request, requiredRoles)) {
        return true;
      }
      throw new ForbiddenException('User role not available');
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException('User role not allowed');
    }

    return true;
  }

  private isBootstrapRequest(
    request: RequestWithProfile,
    requiredRoles: UserRole[],
  ): boolean {
    if (!requiredRoles.includes('system_admin')) {
      return false;
    }
    if (request.method !== 'POST') {
      return false;
    }
    const url = request.originalUrl ?? '';
    if (!url.includes('/api/v1/users/profiles')) {
      return false;
    }
    return true;
  }
}
