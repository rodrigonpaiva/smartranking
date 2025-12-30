import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { tenancyContext } from './tenancy.context';

export const Tenant = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext) => tenancyContext.get()?.tenant,
);
