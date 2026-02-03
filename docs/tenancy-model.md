# Tenancy Model

SmartRanking is tenant-aware by default. **Most authenticated data routes require** the `x-tenant-id` header. Missing or invalid tenant headers raise `400 Tenant header is required`. The resolved tenant is stored inside an `AsyncLocalStorage` scope (and mirrored on `req.tenantId`) so the Mongoose plugin can automatically inject the tenant filter into every query/mutation.

## Tenantless endpoints (allowed without `x-tenant-id`)

A few endpoints must work **before** a tenant is selected (login/bootstrap/public onboarding), so they intentionally run with tenancy disabled:

- `GET /health`, `GET /ready`
- `GET /api/v1/users/me` (auth bootstrap + returns profile)
- `GET /api/v1/clubs/public` (public list for signup)
- `POST /api/v1/clubs/register` (public club registration)
- `POST /api/auth/*`, `GET /api/auth/*` (Better Auth endpoints)

Everything else under `/api/v1/*` should be treated as **tenant-required**.

## Roles

- **system_admin**
  - Must provide an `x-tenant-id` header when interacting with tenant data.
  - If the incoming payload already references a `clubId` (`POST /categories`, `POST /players`, etc.), the guard may fall back to that `clubId` when the header is missing.
  - Recommendation: in the UI, force explicit tenant selection (admin chooses a club/tenant before using admin screens).
- **club / player**
  - Must always operate under the tenant that matches their profile `clubId`.
  - Header mismatches raise `403 Tenant not allowed for this user` and missing headers raise `400`.

## Compound Indexes

Each core collection enforces tenant-aware indexes to prevent duplicate slugs/identifiers across tenants:

| Collection | Index |
|------------|-------|
| clubs      | `{ tenant: 1, slug: 1 }` (unique)
| players    | `{ tenant: 1, clubId: 1, email: 1 }` (unique)
| categories | `{ tenant: 1, clubId: 1, category: 1 }` (unique)
| matches    | `{ tenant: 1, clubId: 1, categoryId: 1 }`

These indexes guarantee lookups stay performant even as the number of tenants grows.

## Tenant Injection & Blocking

- Every request automatically stores `tenantId` on the Express `Request` instance for logging and auditing.
- The tenancy plugin injects the tenant criteria into all supported query types and aggregates. Cross-tenant access is prevented because every query contains the tenant filter.
- Inserts inherit the current tenant transparently so developers never have to set `tenant` fields manually.

For more details see the unit tests under `src/tenancy/tenancy.plugin.spec.ts`, which cover tenant injection, cross-tenant blocking, and the administrative override flow.
