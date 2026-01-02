import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSelfProfileDto } from './create-self-profile.dto';
import { Roles } from '../../auth/roles';

describe('CreateSelfProfileDto', () => {
  it('requires playerId when role is player', async () => {
    const dto = plainToInstance(CreateSelfProfileDto, {
      role: Roles.PLAYER,
      clubId: '507f1f77bcf86cd799439011',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'playerId')).toBe(true);
  });

  it('allows club role without playerId', async () => {
    const dto = plainToInstance(CreateSelfProfileDto, {
      role: Roles.CLUB,
      clubId: '507f1f77bcf86cd799439011',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
