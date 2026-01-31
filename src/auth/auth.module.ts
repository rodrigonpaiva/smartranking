import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { getAuth } from './auth';

@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      useFactory: () => ({
        auth: getAuth(),
      }),
      disableControllers: true,
    }),
  ],
})
export class AuthModule {}
