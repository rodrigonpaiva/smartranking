type DecoratorFactory = (...args: any[]) => void;

const noopDecorator =
  () =>
  (_target?: unknown, _key?: string | symbol, _descriptor?: unknown): void => {};

const noopParamDecorator =
  () =>
  (
    _target?: unknown,
    _key?: string | symbol,
    _index?: number,
  ): void => {};

export const AllowAnonymous: DecoratorFactory = () => noopDecorator();
export const OptionalAuth: DecoratorFactory = () => noopDecorator();
export const Roles: DecoratorFactory = () => noopDecorator();
export const Session: DecoratorFactory = () => noopParamDecorator();

export class AuthGuard {}

export class AuthService<TAuth = unknown> {
  api: Record<string, unknown> = {};
  constructor(_auth?: TAuth) {}
}

export class AuthModule {
  static forRoot(_options: unknown) {
    return {
      module: AuthModule,
      controllers: [],
      providers: [],
    };
  }

  static forRootAsync(_options: unknown) {
    return {
      module: AuthModule,
      controllers: [],
      providers: [],
    };
  }
}

export type UserSession = Record<string, unknown> | null;
