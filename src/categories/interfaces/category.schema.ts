import * as mongoose from 'mongoose';
import { tenancyPlugin } from '../../tenancy/tenancy.plugin';

export const CategorySchema = new mongoose.Schema(
  {
    category: { type: String },
    description: { type: String },
    events: [
      {
        name: { type: String },
        operation: { type: String },
        value: { type: Number },
      },
    ],
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
  },
  { timestamps: true, collection: 'categorie' },
);

CategorySchema.plugin(tenancyPlugin);
CategorySchema.index({ tenant: 1, category: 1 }, { unique: true });
