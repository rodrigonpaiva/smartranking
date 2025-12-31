import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { tenancyContext } from './tenancy.context';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    void data;
    void ctx;
    return tenancyContext.get()?.tenant;
  },
);
