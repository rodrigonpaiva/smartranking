# Tenancy Model

SmartRanking is tenant-aware by default. Every protected request must include the `x-tenant-id` header. Missing or invalid tenant headers raise `400 Tenant header is required`. The resolved tenant is stored inside an `AsyncLocalStorage` scope (and mirrored on `req.tenantId`) so the Mongoose plugin can automatically inject the tenant filter into every query/mutation.

## Roles

- **system_admin**
  - Must provide an `x-tenant-id` header when interacting with existing tenant data.
  - If the incoming payload already references a `clubId` (`POST /categories`, `POST /players`, etc.), the guard will fall back to that `clubId` when the header is missing. This is the only fallback that exists—fleet-wide reads require an explicit tenant context per request.
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
