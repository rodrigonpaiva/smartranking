import { Document, Types } from 'mongoose';
import { Player } from '../../players/interfaces/players.interface';

export interface Category extends Document {
  readonly category: string;
  description: string;
  events: Array<Event>;
  players: Array<Player | Types.ObjectId | string>;
  clubId: string;
}

export interface Event {
  name: string;
  operation: string;
  value: number;
}
