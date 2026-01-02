import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { ClubSchema } from './interfaces/club.schema';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Club', schema: ClubSchema }]),
    AuditModule,
  ],
  controllers: [ClubsController],
  providers: [ClubsService],
})
export class ClubsModule {}
