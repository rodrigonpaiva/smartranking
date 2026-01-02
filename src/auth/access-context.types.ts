import type { UserRole } from './roles';

export interface AccessContext {
  userId: string;
  role: UserRole;
  tenantId?: string | null;
  clubId?: string;
  playerId?: string;
}
