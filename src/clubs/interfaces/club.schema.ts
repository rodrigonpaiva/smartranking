import * as mongoose from 'mongoose';
import { tenancyPlugin } from '../../tenancy/tenancy.plugin';

export const ClubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    description: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'clubs' },
);

ClubSchema.plugin(tenancyPlugin);
ClubSchema.index({ tenant: 1, slug: 1 }, { unique: true });
