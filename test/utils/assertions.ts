export type ApiRecord = Record<string, unknown>;

export const ensureRecord = (value: unknown, context = 'object'): ApiRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${context} to be an object`);
  }
  return value as ApiRecord;
};

export const ensureNumber = (value: unknown, context = 'number'): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected ${context} to be a number`);
  }
  return value;
};

export interface ErrorPayload {
  statusCode: number;
  message: string | string[];
}

export const ensureErrorPayload = (value: unknown): ErrorPayload => {
  const responseRecord = ensureRecord(value, 'response');
  const errorRecord = ensureRecord(responseRecord.error, 'error payload');
  const statusCode = ensureNumber(errorRecord.statusCode, 'error statusCode');
  const messageValue = errorRecord.message;
  if (Array.isArray(messageValue)) {
    return {
      statusCode,
      message: ensureArray(messageValue, 'error message').map((item, index) =>
        ensureString(item, `error message ${index}`),
      ),
    };
  }
  if (messageValue === undefined || messageValue === null) {
    return { statusCode, message: 'Unexpected error' };
  }
  return {
    statusCode,
    message: ensureString(messageValue, 'error message'),
  };
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
