import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    tenantId?: string;
    requestId?: string;
    user?: { id?: string } | null;
  }
}
