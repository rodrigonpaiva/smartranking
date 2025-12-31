import { RequestHandler } from 'express';

const SECURITY_HEADERS: Record<string, string> = {
  'X-DNS-Prefetch-Control': 'off',
  'X-Frame-Options': 'SAMEORIGIN',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  'X-Download-Options': 'noopen',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=()',
};

export const helmet = (): RequestHandler => (req, res, next) => {
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
  res.removeHeader('X-Powered-By');
  next();
};
