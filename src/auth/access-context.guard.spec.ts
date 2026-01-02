import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { AccessContextGuard } from './access-context.guard';
import { UserProfilesService } from '../users/users.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { Roles } from './roles';
import { RequestContextService } from '../common/logger/request-context.service';

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
  let requestContextService: RequestContextService;
  let mergeContextMock: jest.Mock;
  let registerContextMock: jest.Mock;
  let setTenantContextMock: jest.Mock;

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
    tenancyService = {
      setTenant: setTenantMock,
    } as unknown as TenancyService;

    mergeContextMock = jest.fn();
    registerContextMock = jest.fn();
    setTenantContextMock = jest.fn();
    requestContextService = {
      merge: mergeContextMock,
      registerAccessContext: registerContextMock,
      setTenant: setTenantContextMock,
      get: jest.fn(),
      run: jest.fn(),
    } as unknown as RequestContextService;

    guard = new AccessContextGuard(
      reflector,
      profilesService,
      tenancyService,
      requestContextService,
    );
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

  it('allows system admins to fall back to clubId when header missing', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);

    const context = createExecutionContext({
      method: 'POST',
      headers: {},
      body: { clubId: 'club-5' },
      user: { id: 'admin' },
      userProfile: { role: Roles.SYSTEM_ADMIN },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(setTenantMock).toHaveBeenCalledWith('club-5');
  });

  it('rejects missing tenant header for club users', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);

    findByUserIdMock.mockResolvedValue({
      userId: 'club-user',
      role: Roles.CLUB,
      clubId: 'club-1',
    } as never);

    const context = createExecutionContext({
      headers: {},
      user: { id: 'club-user' },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
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

  it('throws bad request when admin lacks tenant context', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);

    const context = createExecutionContext({
      headers: {},
      method: 'GET',
      user: { id: 'admin' },
      userProfile: { role: Roles.SYSTEM_ADMIN },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
