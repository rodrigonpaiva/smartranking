import { Types } from 'mongoose';

export const toIdString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeDoc = value as any;
  return maybeDoc?._id?.toString?.() ?? String(value);
};
