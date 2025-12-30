import * as mongoose from 'mongoose';
import { tenancyPlugin } from '../../tenancy/tenancy.plugin';

export const PlayerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    ranking: { type: Number, default: 1000 },
    position: { type: Number, default: 0 },
    pictureUrl: { type: String, default: '' },
  },
  { timestamps: true, collection: 'players' },
);

PlayerSchema.plugin(tenancyPlugin);
PlayerSchema.index({ tenant: 1, email: 1 }, { unique: true });
