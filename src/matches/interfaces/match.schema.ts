import * as mongoose from 'mongoose';
import { tenancyPlugin } from '../../tenancy/tenancy.plugin';

export const MatchSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    format: { type: String, enum: ['SINGLES', 'DOUBLES'], required: true },
    bestOf: { type: Number, required: true },
    decidingSetType: {
      type: String,
      enum: ['STANDARD', 'ADVANTAGE', 'SUPER_TIEBREAK_7', 'SUPER_TIEBREAK_10'],
      default: 'STANDARD',
    },
    teams: [
      {
        players: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true,
          },
        ],
      },
    ],
    sets: [
      {
        games: [
          {
            teamIndex: { type: Number, required: true },
            score: { type: Number, required: true },
          },
        ],
        tiebreak: [
          {
            teamIndex: { type: Number, required: true },
            score: { type: Number, required: true },
          },
        ],
      },
    ],
    participants: [
      {
        playerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Player',
          required: true,
        },
        result: {
          type: String,
          enum: ['WIN', 'DRAW', 'LOSS'],
          required: true,
        },
      },
    ],
    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'matches' },
);

MatchSchema.plugin(tenancyPlugin);
MatchSchema.index({ tenant: 1, clubId: 1, categoryId: 1 });
