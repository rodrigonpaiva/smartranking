import 'express';
import type { UserProfile } from '../users/interfaces/user-profile.interface';
import type { AccessContext } from '../auth/access-context.types';

declare module 'express-serve-static-core' {
  interface Request {
    tenantId?: string | null;
    requestId?: string;
    user?: { id?: string; email?: string; name?: string } | null;
    userProfile?: UserProfile | null;
    accessContext?: AccessContext | null;
  }
}
