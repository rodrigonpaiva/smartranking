# API Contracts

This document describes the standard query, pagination, and public endpoint
contracts used by the SmartRanking API. Every list endpoint follows the same
filter and pagination semantics so that the frontend (React Query) can rely on
predictable shapes.

## Query Parameters

| Param | Type | Applies to | Description |
| --- | --- | --- | --- |
| `page` | number ≥ 1 (default `1`) | all list endpoints | 1-based page number |
| `limit` | number 1..100 (default `20`) | all list endpoints | Page size cap (100) |
| `q` | string | clubs, players, categories, ranking | Case-insensitive search on the primary text fields (name/email/slug) |
| `clubId` | MongoId string | players, categories, matches (system admins only) | Restrict to a specific club. Club and player roles are auto-scoped to their own club and cannot override |
| `categoryId` | MongoId string | matches | Filter matches list to a single category (validated and tenant scoped) |
| `from` / `to` | ISO8601 string (`YYYY-MM-DD`) | matches list/history | Inclusive date range filter on `playedAt` |

Invalid query parameters return `400` with the standard error envelope.

## Pagination Response Shape

List endpoints return:

```json
{
  "items": [ ... ],
  "page": 1,
  "limit": 20,
  "total": 123
}
```

- `items` – array of hydrated documents
- `page`/`limit` – echo the incoming query (defaults applied if missing)
- `total` – total count matching the filters (before pagination)

If a list is empty, `items` is an empty array and `total` reflects the count.

- `/api/v1/matches` and `/api/v1/matches/by-category/:categoryId` now return this envelope instead of raw arrays.
- `/api/v1/matches/ranking/:categoryId` uses the same wrapper and provides paginated ranking rows.

## Sorting

Current endpoints sort by creation/played date in descending order. Future
sorting support will be added through `sort` + `order` query parameters.

## Public Endpoints

Only the following endpoints are public (no session, no tenant header):

| Endpoint | Purpose | Response |
| --- | --- | --- |
| `GET /api/v1/clubs/public` | Signup dropdown / onboarding | `{ items: [{ _id, name }], page, limit, total }` (id + name only) |

All other endpoints require:

- Better Auth session cookie (`better-auth.session-token`)
- `x-tenant-id` header matching the active tenant/club

Public routes still inherit global rate limits from the Better Auth middleware. Anything under `/api/v1/**` that is not explicit in the table should be considered protected.

## Error Semantics

The backend always responds with the standardized envelope:

```json
{
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/v1/players",
  "error": {
    "statusCode": 403,
    "message": "Tenant not allowed for this user"
  }
}
```

- `400` – invalid payload/query (e.g., malformed page/limit, bad ObjectId)
- `401` – no Better Auth session
- `403` – authenticated but forbidden (role or cross-tenant scope)
- `404` – resource not found or belongs to another tenant (prevents leaking IDs)

Refer to `../security/rbac.md` for detailed role permissions.
