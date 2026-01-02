import * as mongoose from 'mongoose';
import { tenancyPlugin } from '../../tenancy/tenancy.plugin';

export const CategorySchema = new mongoose.Schema(
  {
    tenant: { type: String, required: true, immutable: true, index: true },
    category: { type: String },
    description: { type: String },
    events: [
      {
        name: { type: String },
        operation: { type: String },
        value: { type: Number },
      },
    ],
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    players: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Player',
        },
      ],
      default: [],
    },
  },
  { timestamps: true, collection: 'categorie' },
);

CategorySchema.plugin(tenancyPlugin);
CategorySchema.index({ tenant: 1, clubId: 1, category: 1 }, { unique: true });
CategorySchema.index({ tenant: 1, clubId: 1, createdAt: -1 });
CategorySchema.index({ tenant: 1, category: 1 });
