import { Types } from 'mongoose';

export interface Club {
  readonly _id?: string | Types.ObjectId;
  tenant?: string;
  readonly name: string;
  readonly slug: string;
  readonly city?: string;
  readonly state?: string;
  readonly description?: string;
  readonly logoUrl?: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
