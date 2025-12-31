import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  Global,
} from '@nestjs/common';
import { TenancyMiddleware } from './tenancy.middleware';
import { TenancyModuleOptions } from './tenancy.types';
import { TenancyService } from './tenancy.service';

@Global()
@Module({})
export class TenancyModule implements NestModule {
  private static options: TenancyModuleOptions = {};

  static forRoot(options: TenancyModuleOptions = {}): DynamicModule {
    TenancyModule.options = options;
    TenancyMiddleware.configure(options);
    return {
      module: TenancyModule,
      providers: [
        TenancyService,
        {
          provide: TenancyMiddleware,
          useFactory: () => new TenancyMiddleware(),
        },
      ],
      exports: [TenancyService],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}
