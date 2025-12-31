type DecoratorFactory = (...args: unknown[]) => void;

const noopDecorator =
  () =>
  (target?: unknown, key?: string | symbol, descriptor?: unknown): void => {
    void target;
    void key;
    void descriptor;
  };

const noopParamDecorator =
  () =>
  (target?: unknown, key?: string | symbol, index?: number): void => {
    void target;
    void key;
    void index;
  };

export const AllowAnonymous: DecoratorFactory = () => noopDecorator();
export const OptionalAuth: DecoratorFactory = () => noopDecorator();
export const Roles: DecoratorFactory = () => noopDecorator();
export const Session: DecoratorFactory = () => noopParamDecorator();

export class AuthGuard {}

export class AuthService<TAuth = unknown> {
  api: Record<string, unknown> = {};
  constructor(auth?: TAuth) {
    void auth;
  }
}

export class AuthModule {
  static forRoot(options: unknown) {
    void options;
    return {
      module: AuthModule,
      controllers: [],
      providers: [],
    };
  }

  static forRootAsync(options: unknown) {
    void options;
    return {
      module: AuthModule,
      controllers: [],
      providers: [],
    };
  }
}

export type UserSession = Record<string, unknown> | null;
