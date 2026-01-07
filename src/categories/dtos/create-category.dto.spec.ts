import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCategoryDto, CategoryEventDto } from '../dto/cretae-categorie.dto';

describe('CreateCategoryDto', () => {
  const validObjectId = '507f1f77bcf86cd799439011';
  const validDto = {
    category: 'Test Category',
    description: 'Test Description',
    clubId: validObjectId,
  };

  describe('CategoryEventDto', () => {
    it('should pass with valid event', async () => {
      const dto = plainToInstance(CategoryEventDto, {
        name: 'Victory',
        operation: '+',
        value: 10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with minus operation', async () => {
      const dto = plainToInstance(CategoryEventDto, {
        name: 'Defeat',
        operation: '-',
        value: 5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid operation', async () => {
      const dto = plainToInstance(CategoryEventDto, {
        name: 'Test',
        operation: '*',
        value: 10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with empty name', async () => {
      const dto = plainToInstance(CategoryEventDto, {
        name: '',
        operation: '+',
        value: 10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateCategoryDto', () => {
    it('should pass with valid dto', async () => {
      const dto = plainToInstance(CreateCategoryDto, validDto);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with optional isDoubles true', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validDto,
        isDoubles: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with optional isDoubles false', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validDto,
        isDoubles: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with empty category', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validDto,
        category: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with empty description', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validDto,
        description: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with empty clubId', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validDto,
        clubId: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid events', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validDto,
        events: [
          { name: 'Win', operation: '+', value: 10 },
          { name: 'Draw', operation: '+', value: 5 },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with empty events array', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validDto,
        events: [],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with missing required fields', async () => {
      const dto = plainToInstance(CreateCategoryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
