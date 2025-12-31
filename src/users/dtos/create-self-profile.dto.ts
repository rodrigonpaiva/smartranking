import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../auth/roles';
import type { UserRole } from '../../auth/roles';

export class CreateSelfProfileDto {
  @IsString()
  @IsIn([Roles.CLUB, Roles.PLAYER])
  readonly role: UserRole;

  @IsString()
  @IsNotEmpty()
  readonly clubId: string;

  @IsOptional()
  @IsString()
  readonly playerId?: string;
}
