import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { trim } from '../../common/transformers/trim.transformer';
import { Roles } from '../../auth/roles';
import type { UserRole } from '../../auth/roles';

export class CreateUserProfileDto {
  @Transform(trim)
  @IsMongoId()
  readonly userId: string;

  @IsEnum(Roles)
  readonly role: UserRole;

  @ValidateIf(
    (dto: CreateUserProfileDto) =>
      dto.role === Roles.CLUB || dto.role === Roles.PLAYER,
  )
  @IsDefined()
  @IsNotEmpty()
  @IsMongoId()
  readonly clubId?: string;

  @ValidateIf((dto: CreateUserProfileDto) => dto.role === Roles.PLAYER)
  @IsDefined()
  @IsNotEmpty()
  @IsMongoId()
  readonly playerId?: string;
}
