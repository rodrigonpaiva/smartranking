import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategorySchema } from '../categories/interfaces/category.schema';
import { ClubSchema } from '../clubs/interfaces/club.schema';
import { PlayerSchema } from '../players/interfaces/player.schema';
import { MatchSchema } from './interfaces/match.schema';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Match', schema: MatchSchema },
      { name: 'Category', schema: CategorySchema },
      { name: 'Club', schema: ClubSchema },
      { name: 'Player', schema: PlayerSchema },
    ]),
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}
