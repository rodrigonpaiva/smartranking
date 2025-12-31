import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { AccessContextGuard } from './access-context.guard';
import { UserProfilesService } from '../users/users.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { Roles } from './roles';

const createExecutionContext = (
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

describe('AccessContextGuard', () => {
  let guard: AccessContextGuard;
  let reflector: jest.Mocked<Reflector>;
  let profilesService: UserProfilesService;
  let tenancyService: TenancyService;
  let findByUserIdMock: jest.Mock;
  let setTenantMock: jest.Mock;
  let disableTenancyMock: jest.Mock;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    findByUserIdMock = jest.fn();
    profilesService = {
      findByUserId: findByUserIdMock,
      hasAnyProfile: jest.fn(),
    } as unknown as UserProfilesService;

    setTenantMock = jest.fn();
    disableTenancyMock = jest.fn();
    tenancyService = {
      setTenant: setTenantMock,
      disableTenancyForCurrentScope: disableTenancyMock,
    } as unknown as TenancyService;

    guard = new AccessContextGuard(reflector, profilesService, tenancyService);
  });

  it('allows public routes without authentication', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const context = createExecutionContext({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('loads profiles and sets tenant when missing on request', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);

    findByUserIdMock.mockResolvedValue({
      userId: 'user-1',
      role: Roles.CLUB,
      clubId: 'club-1',
    } as never);

    const request = {
      headers: { 'x-tenant-id': 'club-1' },
      user: { id: 'user-1' },
    };

    const context = createExecutionContext(request);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findByUserIdMock).toHaveBeenCalledWith('user-1');
    expect(setTenantMock).toHaveBeenCalledWith('club-1');
  });

  it('disables tenancy for system admin wide GET access', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);

    const context = createExecutionContext({
      method: 'GET',
      headers: {},
      originalUrl: '/api/v1/users',
      user: { id: 'admin' },
      userProfile: { role: Roles.SYSTEM_ADMIN },
      query: {},
      params: {},
      body: {},
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(disableTenancyMock).toHaveBeenCalled();
  });

  it('blocks cross-tenant access for club roles', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);

    const request = {
      headers: { 'x-tenant-id': 'club-b' },
      user: { id: 'club-user' },
      userProfile: { role: Roles.CLUB, clubId: 'club-a' },
    };

    const context = createExecutionContext(request);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws unauthorized when user id missing', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    const context = createExecutionContext({ headers: {} });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
