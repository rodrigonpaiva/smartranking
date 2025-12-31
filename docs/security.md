# Security Overview

SmartRanking enforces multiple layers of protection:

- **Per-request safety headers**: `helmet()`-style middleware applies `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, and disables `X-Powered-By` on every response. These headers mitigate clickjacking, protocol downgrade, and MIME sniffing vectors.
- **Authentication & authorization**:
  - Better Auth manages sessions/roles. Every request passes through `AccessContextGuard` + `RolesGuard` to inject user profiles, enforce RBAC, and prevent bootstrapping shortcuts except for the initial admin.
  - Forbidden (403) vs Unauthorized (401) semantics follow Nest best practices: missing credentials produce `401`, role mismatches produce `403`.
- **Tenancy isolation**: the tenancy middleware + Mongoose plugin automatically scopes every query/mutation to the active tenant. System administrators may temporarily disable scoping for fleet-wide reads, but tenants can never see each other’s data.
- **Input validation**:
  - DTOs rely on `class-validator`.
  - `ValidationParamPipe` trims/limits route parameters and rejects unsafe characters, preventing operator injections in IDs.
- **Transport security**: CORS is limited to the Better Auth origin and the local club dashboard. HSTS headers encourage HTTPS-only access in production.
- **Dependency scanning**: the CI build step runs `npm audit --production` on every PR/push to catch known vulnerabilities in runtime dependencies.
- **Observability**: structured request logs include requestId, tenant, userId, route, and duration to support incident response. Domain events log match creation/confirmation and ranking rebuilds for auditing.

Refer to `docs/tenancy-model.md` for tenancy specifics and `docs/ranking-system.md` for the deterministic ranking rules.
