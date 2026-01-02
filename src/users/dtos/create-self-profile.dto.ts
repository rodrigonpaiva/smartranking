import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { trim } from '../../common/transformers/trim.transformer';
import { Roles } from '../../auth/roles';
import type { UserRole } from '../../auth/roles';

export class CreateSelfProfileDto {
  @IsIn([Roles.CLUB, Roles.PLAYER])
  readonly role: UserRole;

  @Transform(trim)
  @IsMongoId()
  readonly clubId: string;

  @ValidateIf((dto: CreateSelfProfileDto) => dto.role === Roles.PLAYER)
  @IsDefined()
  @IsNotEmpty()
  @IsMongoId()
  readonly playerId?: string;
}
