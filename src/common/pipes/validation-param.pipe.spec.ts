import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ValidationParamPipe } from './validation-param.pipe';

describe('ValidationParamPipe', () => {
  const metadata: ArgumentMetadata = {
    type: 'param',
    data: 'id',
    metatype: String,
  };
  let pipe: ValidationParamPipe;

  beforeEach(() => {
    pipe = new ValidationParamPipe();
  });

  it('should return the value when provided', () => {
    const value: string = '123';
    expect(pipe.transform(value, metadata)).toEqual(value);
  });

  it('should trim whitespace and return sanitized value', () => {
    const result = pipe.transform('  player-01  ', metadata);
    expect(result).toBe('player-01');
  });

  it('should throw an error when the value is missing', () => {
    expect(() => pipe.transform('', metadata)).toThrow(BadRequestException);
  });

  it('should reject unsafe characters', () => {
    expect(() => pipe.transform('user${1}', metadata)).toThrow(
      BadRequestException,
    );
  });

  it('should reject overly long values', () => {
    const oversized: string = 'a'.repeat(257);
    expect(() => pipe.transform(oversized, metadata)).toThrow(
      BadRequestException,
    );
  });
});
