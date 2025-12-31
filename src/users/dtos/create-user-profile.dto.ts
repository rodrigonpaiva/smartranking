import { IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { Roles } from '../../auth/roles';
import type { UserRole } from '../../auth/roles';

export class CreateUserProfileDto {
  @IsString()
  @IsNotEmpty()
  readonly userId: string;

  @IsString()
  @IsIn([Roles.SYSTEM_ADMIN, Roles.CLUB, Roles.PLAYER])
  readonly role: UserRole;

  @ValidateIf((o) => o.role === Roles.CLUB || o.role === Roles.PLAYER)
  @IsString()
  @IsNotEmpty()
  readonly clubId?: string;

  @ValidateIf((o) => o.role === Roles.PLAYER)
  @IsString()
  @IsNotEmpty()
  readonly playerId?: string;
}
