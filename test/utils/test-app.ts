import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { UserProfile } from '../../src/users/interfaces/user-profile.interface';

const headerValue = (req: Request, name: string): string | undefined => {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
};

export const attachTestUserContext = (app: INestApplication): void => {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const userId = headerValue(req, 'x-test-user');
    if (userId) {
      req.user = { id: userId, email: `${userId}@example.com` };
    } else {
      req.user = req.user ?? null;
    }

    const role = headerValue(req, 'x-test-role');
    const clubId = headerValue(req, 'x-test-club');
    const playerId = headerValue(req, 'x-test-player');
    if (userId && role) {
      req.userProfile = {
        userId,
        role: role as UserProfile['role'],
        clubId: clubId ?? undefined,
        playerId: playerId ?? undefined,
      } as UserProfile;
    }

    next();
  });
};
