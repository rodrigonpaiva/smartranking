import { Document } from 'mongoose';
export interface Player extends Document {
  readonly email: string;
  readonly phone: string;
  readonly clubId: string;
  name: string;
  ranking: number;
  position: number;
  pictureUrl: string;
}
