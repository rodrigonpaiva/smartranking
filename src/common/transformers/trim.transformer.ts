import type { TransformFnParams } from 'class-transformer';

const coerceString = (input: unknown): string | undefined => {
  if (typeof input !== 'string') {
    return undefined;
  }
  return input.trim();
};

export const trim = ({ value }: TransformFnParams): string | undefined =>
  coerceString(value);

export const trimLowercase = ({
  value,
}: TransformFnParams): string | undefined => {
  const trimmed = coerceString(value);
  return trimmed ? trimmed.toLowerCase() : trimmed;
};
