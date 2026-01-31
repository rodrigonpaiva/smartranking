import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { getAuth } from './auth';

@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth: getAuth(),
      disableControllers: true,
    }),
  ],
})
export class AuthModule {}
