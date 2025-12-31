export interface Club {
  readonly _id?: string;
  readonly name: string;
  readonly slug: string;
  readonly city?: string;
  readonly state?: string;
  readonly description?: string;
  readonly logoUrl?: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
