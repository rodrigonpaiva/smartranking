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
      // The API uses Better Auth via the Express handler mounted in main.ts.
      // Nest-level auth guard would conflict with our custom session/tenant guards.
      disableGlobalAuthGuard: true,
    }),
  ],
})
export class AuthModule {}
