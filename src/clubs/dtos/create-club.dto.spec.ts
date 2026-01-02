import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClubDto } from './create-club.dto';

describe('CreateClubDto', () => {
  it('rejects invalid slug characters', async () => {
    const dto = plainToInstance(CreateClubDto, {
      name: 'Valid Name',
      slug: 'Invalid Slug',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'slug')).toBe(true);
  });

  it('accepts valid payload', async () => {
    const dto = plainToInstance(CreateClubDto, {
      name: 'Valid Club',
      slug: 'valid-club',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
