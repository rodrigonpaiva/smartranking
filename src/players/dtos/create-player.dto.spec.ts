import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePlayerDto } from './create-player.dto';

describe('CreatePlayerDto', () => {
  const validDto = {
    email: 'test@example.com',
    phone: '+5511999999999',
    name: 'Test Player',
    clubId: '507f1f77bcf86cd799439011',
  };

  describe('email validation', () => {
    it('should pass with valid email', async () => {
      const dto = plainToInstance(CreatePlayerDto, validDto);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid email', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        email: 'invalid-email',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should transform email to lowercase', () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        email: 'TEST@EXAMPLE.COM',
      });
      expect(dto.email).toBe('test@example.com');
    });

    it('should trim email whitespace', () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        email: '  test@example.com  ',
      });
      expect(dto.email).toBe('test@example.com');
    });
  });

  describe('phone validation', () => {
    it('should pass with valid phone number', async () => {
      const dto = plainToInstance(CreatePlayerDto, validDto);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with phone number starting with +', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        phone: '+5511999999999',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with short phone number', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        phone: '123',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('phone');
    });

    it('should fail with phone containing letters', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        phone: '1234567890a',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should trim phone whitespace', () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        phone: '  +5511999999999  ',
      });
      expect(dto.phone).toBe('+5511999999999');
    });
  });

  describe('name validation', () => {
    it('should pass with valid name', async () => {
      const dto = plainToInstance(CreatePlayerDto, validDto);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with name shorter than 2 characters', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        name: 'A',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });

    it('should fail with name longer than 120 characters', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        name: 'A'.repeat(121),
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });

    it('should trim name whitespace', () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        name: '  Test Player  ',
      });
      expect(dto.name).toBe('Test Player');
    });
  });

  describe('clubId validation', () => {
    it('should pass with valid MongoDB ObjectId', async () => {
      const dto = plainToInstance(CreatePlayerDto, validDto);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid MongoDB ObjectId', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        clubId: 'invalid-id',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('clubId');
    });

    it('should fail with empty clubId', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        ...validDto,
        clubId: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('full dto validation', () => {
    it('should pass with all valid fields', async () => {
      const dto = plainToInstance(CreatePlayerDto, validDto);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with missing required fields', async () => {
      const dto = plainToInstance(CreatePlayerDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with multiple invalid fields', async () => {
      const dto = plainToInstance(CreatePlayerDto, {
        email: 'invalid',
        phone: '123',
        name: 'A',
        clubId: 'invalid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(4);
    });
  });
});
