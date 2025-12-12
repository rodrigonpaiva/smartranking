import { Document } from 'mongoose';
export interface Player extends Document {
  readonly email: string;
  readonly phone: string;
  name: string;
  ranking: string;
  position: number;
  pictureUrl: string;
}
