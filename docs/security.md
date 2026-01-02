# Security Overview

SmartRanking enforces multiple layers of protection:

- **Per-request safety headers**: `helmet()`-style middleware applies `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, and disables `X-Powered-By` on every response. These headers mitigate clickjacking, protocol downgrade, and MIME sniffing vectors.
- **Authentication & authorization**:
  - Better Auth manages sessions/roles. Every request passes through `AccessContextGuard` + `RolesGuard` to inject user profiles, enforce RBAC, and prevent bootstrapping shortcuts except for the initial admin.
  - `x-tenant-id` is mandatory on protected routes. Authenticated requests without a tenant produce `400 Tenant header is required`, missing sessions produce `401`, and role/tenant mismatches produce `403`.
- **Tenancy isolation**: the tenancy middleware + Mongoose plugin automatically scopes every query/mutation to the active tenant. System administrators select a tenant via the `x-tenant-id` header (or an explicit `clubId` in the payload) before touching tenant data, so protected data never leaks across clubs.
- **Error envelopes**: a global `AllExceptionsFilter` normalizes every error to `{ timestamp, path, error: { statusCode, message } }` so the frontend can reliably show validation/auth errors without inspecting implementation-specific fields.
- **Input validation**:
  - DTOs rely on `class-validator`.
  - `ValidationParamPipe` trims/limits route parameters and rejects unsafe characters, preventing operator injections in IDs.
- **Transport security**: CORS is limited to the Better Auth origin and the local club dashboard. HSTS headers encourage HTTPS-only access in production.
- **Dependency scanning**: the CI build step runs `npm audit --production` on every PR/push to catch known vulnerabilities in runtime dependencies.
- **Observability**: structured request logs include requestId, tenant, userId, route, and duration to support incident response. Domain events log match creation/confirmation and ranking rebuilds for auditing.

Refer to `docs/tenancy-model.md` for tenancy specifics and `docs/ranking-system.md` for the deterministic ranking rules.
