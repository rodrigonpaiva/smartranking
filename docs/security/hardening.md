# Security Hardening Baseline

The backend enforces a consistent security posture across all HTTP traffic.

## HTTP Middleware

- **Helmet** – enabled globally with `frameguard: deny`, `Referrer-Policy: no-referrer`,
  and powered-by suppression. CSP and COEP are disabled to keep Swagger/devtools
  functional; tighten as needed for production.
- **Request IDs** – every request receives / echoes `x-request-id`, which is
  injected into error payloads for correlation.
- **CORS** – only the configured allowlist is accepted (`FRONTEND_URL`,
  `BETTER_AUTH_URL`, `http://localhost:5173`, `http://localhost:3000`,
  `http://localhost:8080`). Requests without an origin (e.g., cURL) are allowed;
  other origins are rejected without CORS headers. Credentials and the
  `x-tenant-id` header are supported explicitly.

## Cookies / Sessions

Better Auth cookies inherit secure defaults via `defaultCookieAttributes`:

- `HttpOnly` always, and `Secure` whenever `NODE_ENV === 'production'`
- `SameSite` defaults to `lax` (override with `BETTER_AUTH_COOKIE_SAMESITE`)
- Optional domain override via `BETTER_AUTH_COOKIE_DOMAIN`

Origin checks remain enabled in production; opt-out only by setting
`BETTER_AUTH_DISABLE_ORIGIN_CHECK=true`.

## Rate Limiting

- **Global API** – `@nestjs/throttler` enforces `RATE_LIMIT_LIMIT` requests per
  `RATE_LIMIT_TTL` seconds (defaults: 120 req / 60s).
- **Auth endpoints** – `/api/auth/**` is additionally protected by
  `express-rate-limit` (defaults: 10 req / 60s, tune via `AUTH_RATE_LIMIT_MAX`
  and `AUTH_RATE_LIMIT_TTL`).
- **Profile upserts** – `UsersController` self/moderated profile writes are
  throttled at 20 req / 60s.

429 responses reuse the standard error envelope.

## Audit Logging

`src/audit/audit.logger.ts` emits structured JSON logs for privileged actions
(create/update/delete on clubs, players, categories, matches, and user profiles).
Fields include `event`, `tenantId`, `userId`, `role`, and relevant entity IDs.
Logs are noise-free (no emails/PII) and ready for log aggregation.

## Dependency Hygiene

Run `npm run audit:prod` to scan production dependencies. Findings must be
triaged and either patched or documented in `docs/security/dependencies.md`.

## Manual Checklist

1. Verify Helmet headers via `curl -I` and ensure no duplicate `X-Powered-By`.
2. Confirm browsers block origins outside the allowlist.
3. Hammer `/api/auth/sign-in/email` to ensure 429 responses after the configured
   threshold.
4. Review audit logs when creating or updating privileged resources.
5. Ensure cookies show `HttpOnly; Secure` in production and default to
   `SameSite=Lax`.
