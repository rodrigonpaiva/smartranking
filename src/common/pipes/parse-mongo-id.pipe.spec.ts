import { BadRequestException } from '@nestjs/common';
import { ParseMongoIdPipe } from './parse-mongo-id.pipe';

describe('ParseMongoIdPipe', () => {
  let pipe: ParseMongoIdPipe;

  beforeEach(() => {
    pipe = new ParseMongoIdPipe();
  });

  describe('transform', () => {
    it('should pass valid MongoDB ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011';
      const result = pipe.transform(validId);
      expect(result).toBe(validId);
    });

    it('should pass another valid MongoDB ObjectId', () => {
      const validId = '5f9a1b9b9c9d9e9f9a9b9c9d';
      const result = pipe.transform(validId);
      expect(result).toBe(validId);
    });

    it('should throw BadRequestException for invalid id', () => {
      const invalidId = 'invalid-id';
      expect(() => pipe.transform(invalidId)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for short id', () => {
      const shortId = '507f1f77bcf8';
      expect(() => pipe.transform(shortId)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for long id', () => {
      const longId = '507f1f77bcf86cd799439011extra';
      expect(() => pipe.transform(longId)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty string', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for id with special characters', () => {
      const invalidId = '507f1f77bcf86cd7994390!1';
      expect(() => pipe.transform(invalidId)).toThrow(BadRequestException);
    });

    it('should include proper error message', () => {
      try {
        pipe.transform('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain(
          'Validation failed',
        );
      }
    });

    it('should accept 24 character hex string', () => {
      const validId = 'aabbccddeeff001122334455';
      const result = pipe.transform(validId);
      expect(result).toBe(validId);
    });

    it('should reject id with uppercase letters beyond hex range', () => {
      const invalidId = '507f1f77bcf86cdGHI439011';
      expect(() => pipe.transform(invalidId)).toThrow(BadRequestException);
    });
  });
});
