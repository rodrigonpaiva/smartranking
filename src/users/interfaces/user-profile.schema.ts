import * as mongoose from 'mongoose';
import { Roles } from '../../auth/roles';
import { tenancyPlugin } from '../../tenancy/tenancy.plugin';

export const UserProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    role: {
      type: String,
      enum: [Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER],
      required: true,
    },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  },
  { timestamps: true, collection: 'user_profiles' },
);

UserProfileSchema.plugin(tenancyPlugin);
UserProfileSchema.index({ tenant: 1, userId: 1 });
UserProfileSchema.index({ tenant: 1, clubId: 1 });
UserProfileSchema.index({ tenant: 1, playerId: 1 });
