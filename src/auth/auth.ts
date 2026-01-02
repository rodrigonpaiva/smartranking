import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME;

if (!mongoUri) {
  throw new Error('MONGODB_URI is required for Better Auth.');
}

if (!mongoDbName) {
  throw new Error('MONGODB_DB_NAME is required for Better Auth.');
}

const client = new MongoClient(mongoUri);
const db = client.db(mongoDbName);
const trustedOrigins = [
  process.env.BETTER_AUTH_URL ?? 'http://localhost:8080',
  'http://localhost:5173',
];
const rateLimitMax = Number(process.env.BETTER_AUTH_RATE_LIMIT_MAX ?? '100');
const rateLimitWindow = Number(
  process.env.BETTER_AUTH_RATE_LIMIT_WINDOW ?? '60',
);
const isProduction = process.env.NODE_ENV === 'production';
const sameSiteEnv =
  process.env.BETTER_AUTH_COOKIE_SAMESITE?.toLowerCase() ?? 'lax';
const sameSite: 'lax' | 'strict' | 'none' =
  sameSiteEnv === 'strict' || sameSiteEnv === 'none' ? sameSiteEnv : 'lax';

export const authMongoClient = client;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
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
