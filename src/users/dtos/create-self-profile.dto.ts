import { Transform } from 'class-transformer';
import {
  IsIn,
  IsMongoId,
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

  @ValidateIf((dto: CreateSelfProfileDto) => Boolean(dto.playerId))
  @IsMongoId()
  readonly playerId?: string;
}
