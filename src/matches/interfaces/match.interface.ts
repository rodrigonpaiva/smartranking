import { Document } from 'mongoose';

export interface Match extends Document {
  categoryId: string;
  clubId: string;
  format: 'SINGLES' | 'DOUBLES';
  bestOf: number;
  decidingSetType:
    | 'STANDARD'
    | 'ADVANTAGE'
    | 'SUPER_TIEBREAK_7'
    | 'SUPER_TIEBREAK_10';
  teams: Array<{
    players: string[];
  }>;
  sets: Array<{
    games: Array<{
      teamIndex: number;
      score: number;
    }>;
    tiebreak?: Array<{
      teamIndex: number;
      score: number;
    }>;
  }>;
  playedAt: Date;
  participants: Array<{
    playerId: string;
    result: 'WIN' | 'DRAW' | 'LOSS';
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}
