import * as mongoose from 'mongoose';

export const PlayerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    ranking: { type: Number, default: 1000 },
    position: { type: Number, default: 0 },
    pictureUrl: { type: String, default: '' },
  },
  { timestamps: true, collection: 'players' },
);
