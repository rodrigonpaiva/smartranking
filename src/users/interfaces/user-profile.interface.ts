import { Document } from 'mongoose';
import { UserRole } from '../../auth/roles';

export interface UserProfile extends Document {
  userId: string;
  role: UserRole;
  clubId?: string;
  playerId?: string;
}
