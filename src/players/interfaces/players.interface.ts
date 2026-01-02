import { Document, Types } from 'mongoose';
export interface Player extends Document {
  tenant?: string;
  readonly email: string;
  readonly phone: string;
  readonly clubId: string | Types.ObjectId;
  name: string;
  ranking?: number;
  position?: number;
  pictureUrl?: string;
}

export interface CreatePlayerData {
  tenant?: string;
  email: string;
  phone: string;
  clubId: Types.ObjectId;
  name: string;
  ranking?: number;
  position?: number;
  pictureUrl?: string;
}
