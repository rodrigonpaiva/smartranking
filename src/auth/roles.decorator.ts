import { SetMetadata } from '@nestjs/common';
import { UserRole } from './roles';

export const ROLES_KEY = 'APP_ROLES';

export const RequireRoles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);
