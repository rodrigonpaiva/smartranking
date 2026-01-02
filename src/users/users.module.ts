import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserProfileSchema } from './interfaces/user-profile.schema';
import { UsersController } from './users.controller';
import { UserProfilesService } from './users.service';
import { ClubSchema } from '../clubs/interfaces/club.schema';
import { PlayerSchema } from '../players/interfaces/player.schema';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'UserProfile', schema: UserProfileSchema },
      { name: 'Club', schema: ClubSchema },
      { name: 'Player', schema: PlayerSchema },
    ]),
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UserProfilesService],
  exports: [UserProfilesService],
})
export class UsersModule {}
