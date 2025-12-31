import { Module } from '@nestjs/common';
import { PlayersModule } from './players/players.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CategoriesModule } from './categories/categories.module';
import { AuthModule } from './auth/auth.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { ClubsModule } from './clubs/clubs.module';
import { UsersModule } from './users/users.module';
import { MatchesModule } from './matches/matches.module';
import { APP_GUARD } from '@nestjs/core';
import { AccessContextGuard } from './auth/access-context.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
        dbName: configService.getOrThrow<string>('MONGODB_DB_NAME'),
      }),
    }),
    TenancyModule.forRoot({
      headerName: 'x-tenant-id',
      queryParameterName: 'tenant',
      defaultTenant: 'default',
    }),
    AuthModule,
    ClubsModule,
    PlayersModule,
    CategoriesModule,
    UsersModule,
    MatchesModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessContextGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
