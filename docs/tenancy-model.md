# Tenancy Model

SmartRanking is tenant-aware by default. Every request enters the `TenancyMiddleware`, which resolves the tenant in the following order:

1. `x-tenant-id` header
2. `tenant` query string
3. Configured default (`default`)

The resolved tenant is stored inside an `AsyncLocalStorage` scope and written as the `tenant` field in every MongoDB document by a Mongoose plugin. All queries (`find*`, `update*`, `delete*`, `insertMany`, aggregates, and `save`) automatically receive a tenant filter so data never leaks across clubs or tenants.

## Roles

- **system_admin**
  - Can omit the tenant in `GET` operations. When no tenant, no `clubId`, and no explicit tenant are provided the guard disables tenancy for that request, allowing fleet-wide views (e.g., governance dashboards).
  - When a tenant header/query is provided, normal tenant scoping applies.
- **club / player**
  - Must always operate under a tenant. Requests missing a tenant automatically fall back to the default tenant declared in configuration.
  - Cross-tenant headers are blocked by `AccessContextGuard`.

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
- The tenancy plugin injects the tenant criteria into all supported query types and aggregates. Cross-tenant access is prevented because every query contains the tenant filter unless the guard explicitly disables it for the scope (system_admin governance reads).
- Inserts inherit the current tenant transparently so developers never have to set `tenant` fields manually.

For more details see the unit tests under `src/tenancy/tenancy.plugin.spec.ts`, which cover tenant injection, cross-tenant blocking, and the administrative override flow.
