import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles';

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: RolesGuard;

  const createContext = (
    request: Record<string, unknown>,
  ): ExecutionContext => {
    const http = {
      getRequest: () => request,
    };
    return {
      switchToHttp: () => http,
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('allows requests when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createContext({});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows self profile bootstrap when profile is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([Roles.SYSTEM_ADMIN]);
    const context = createContext({
      method: 'POST',
      originalUrl: '/api/v1/users/profiles/self',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks moderator bootstrap when profile is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([Roles.SYSTEM_ADMIN]);
    const context = createContext({
      method: 'POST',
      originalUrl: '/api/v1/users/profiles',
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('blocks missing roles when bootstrap rules are not met', () => {
    reflector.getAllAndOverride.mockReturnValue([Roles.CLUB]);
    const context = createContext({
      accessContext: null,
      userProfile: null,
      method: 'GET',
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows matching role and blocks non-matching roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Roles.CLUB]);
    const allowedContext = createContext({
      accessContext: {
        userId: 'club-user',
        role: Roles.CLUB,
      },
    });
    expect(guard.canActivate(allowedContext)).toBe(true);

    const blockedContext = createContext({
      accessContext: {
        userId: 'player-1',
        role: Roles.PLAYER,
      },
    });
    expect(() => guard.canActivate(blockedContext)).toThrow(ForbiddenException);
  });
});
