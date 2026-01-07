import { Document, HydratedDocument, Types } from 'mongoose';
import { Player } from '../../players/interfaces/players.interface';

export interface Category extends Document {
  tenant: string;
  readonly category: string;
  description?: string;
  isDoubles?: boolean;
  events?: Array<Event>;
  players: Array<Player | Types.ObjectId | string>;
  clubId: string;
}

export interface Event {
  name: string;
  operation: string;
  value: number;
}

export type CategoryDocument = HydratedDocument<Category>;
