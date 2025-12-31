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
    const value = '123';
    expect(pipe.transform(value, metadata)).toEqual(value);
  });

  it('should throw an error when the value is missing', () => {
    expect(() => pipe.transform('', metadata)).toThrow(BadRequestException);
  });
});
