export type ApiRecord = Record<string, unknown>;

export const ensureRecord = (value: unknown, context = 'object'): ApiRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${context} to be an object`);
  }
  return value as ApiRecord;
};

export const ensureErrorPayload = (value: unknown): ApiRecord => {
  const responseRecord = ensureRecord(value, 'response');
  return ensureRecord(responseRecord.error, 'error payload');
};

export const ensureArray = <T = unknown>(
  value: unknown,
  context = 'array',
): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${context} to be an array`);
  }
  return value as T[];
};

export const ensureString = (value: unknown, context = 'string'): string => {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${context} to be a string`);
  }
  return value;
};

export const ensureNullableString = (
  value: unknown,
  context = 'string',
): string | null => {
  if (value === null) {
    return null;
  }
  if (value === undefined) {
    return null;
  }
  return ensureString(value, context);
};
