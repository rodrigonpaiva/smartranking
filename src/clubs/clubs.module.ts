import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { ClubSchema } from './interfaces/club.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Club', schema: ClubSchema }])],
  controllers: [ClubsController],
  providers: [ClubsService],
})
export class ClubsModule {}
