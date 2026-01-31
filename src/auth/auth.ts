import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';

let authInstance: ReturnType<typeof betterAuth> | null = null;
export let authMongoClient: MongoClient | null = null;

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required for Better Auth.`);
  }
  return value;
};

const parseTrustedOrigins = (): string[] => {
  const origins: string[] = [];
  origins.push(process.env.BETTER_AUTH_URL ?? 'http://localhost:8080');

  const frontendOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (frontendOrigins) {
    const parsed = frontendOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    origins.push(...parsed);
  } else if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173');
  }

  return [...new Set(origins)];
};

export const getAuth = (): ReturnType<typeof betterAuth> => {
  if (authInstance) {
    return authInstance;
  }

  const mongoUri = requireEnv('MONGODB_URI');
  const mongoDbName = requireEnv('MONGODB_DB_NAME');

  const client = new MongoClient(mongoUri);
  authMongoClient = client;
  const db = client.db(mongoDbName);

  const trustedOrigins = parseTrustedOrigins();
  const rateLimitMax = Number(process.env.BETTER_AUTH_RATE_LIMIT_MAX ?? '100');
  const rateLimitWindow = Number(
    process.env.BETTER_AUTH_RATE_LIMIT_WINDOW ?? '60',
  );
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSiteEnv =
    process.env.BETTER_AUTH_COOKIE_SAMESITE?.toLowerCase() ?? 'lax';
  const sameSite: 'lax' | 'strict' | 'none' =
    sameSiteEnv === 'strict' || sameSiteEnv === 'none' ? sameSiteEnv : 'lax';

  authInstance = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: requireEnv('BETTER_AUTH_SECRET'),
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
    },
    advanced: {
      useSecureCookies: isProduction,
      disableOriginCheck:
        process.env.BETTER_AUTH_DISABLE_ORIGIN_CHECK === 'true' || !isProduction,
      defaultCookieAttributes: {
        sameSite,
        httpOnly: true,
        secure: isProduction,
        path: '/',
        domain: process.env.BETTER_AUTH_COOKIE_DOMAIN || undefined,
      },
    },
    rateLimit: {
      enabled: true,
      window: rateLimitWindow,
      max: rateLimitMax,
      storage: 'memory',
    },
    database: mongodbAdapter(db),
    experimental: {
      joins: true,
    },
  });

  return authInstance;
};
