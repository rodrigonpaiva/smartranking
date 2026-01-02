# Operability Guide

## Environment & Secrets
- **Dev**: copy `.env.example` to `.env`, set `MONGODB_URI`, `MONGODB_DB_NAME`, `PORT`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET`.
- **Prod**: config is pulled from the platform secret store. Rotate by updating the secret in the vault, re-deploying, and letting Nest reboot (missing vars throw via `ConfigService.getOrThrow`).
- **Rotation**: Better Auth keys can be rotated by issuing a new key pair, updating `BETTER_AUTH_SECRET`, and recycling pods; Mongo credentials follow the same flow via the DB secret bundle.

## Health, Readiness & Indexes
- `GET /health` reports API + Mongo reachability plus heap usage; `GET /ready` ensures Mongo + collection indexes are accessible. Both are public and fast.
- To validate indexes manually run `mongosh "<URI>" --eval "db.players.getIndexes();"` for each critical collection (`players`, `clubs`, `categories`, `matches`, `userprofiles`). Expect tenant + uniqueness indexes.

## Logging & Tracing
- Structured JSON logging (Pino) emits `requestId`, `tenantId`, `userId`, `role`, method, path, status, and duration under `http.request`.
- Audit events log under `audit.event` with `{ event, tenantId, actorUserId, role, targetIds }`.
- Rate limiting failures log as `http.exception` with `statusCode=429`.
- When debugging failed mutations search for `http.exception` filtered by `requestId` (the same value is returned in the HTTP response body).

## Debugging Checklist
- **401**: Better Auth session missing/expired; confirm `SessionCookie` is present and `BETTER_AUTH_URL` is reachable.
- **403**: RBAC or tenant scope mismatch. Verify `x-tenant-id` equals the club/tenant tied to the profile and that the route `@RequireRoles` allows the current role.
- **Tenant scoping**: ensure seed/test calls include `x-tenant-id=<clubId>`; logs will show the resolved tenant under `tenantId`.
- **Validation errors (400)**: response includes `error.message` with class-validator output; cross-check DTOs in `src/**/dtos`.

## Auth Validation (Manual)
- Sign-in admin (no tenant header needed):
  - `curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"email":"admin@demo.smartranking","password":"Admin123!"}' http://localhost:8080/api/auth/sign-in/email`
- Sign-in player (no tenant header needed):
  - `curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"email":"player@demo.smartranking","password":"Player123!"}' http://localhost:8080/api/auth/sign-in/email`
- Fetch profile (tenant required):
  - `curl -i -b cookies.txt -H "x-tenant-id: <clubId>" http://localhost:8080/api/v1/users/me`

## Seeds & Sample Data
- Command: `npm run seed:dev` (idempotent).
- Creates: 1 system admin, 2 tenant-isolated clubs (`demo-tennis-club`, `laguna-padel-club`), 10+ players per club, categories with assignments, and featured matches per club.
- Auth credentials (also emitted in logs under `seed.summary`):
  - Admin `admin@demo.smartranking` / `Admin123!`
  - Club managers `club.demo@demo.smartranking` & `club.laguna@demo.smartranking` / `Club123!`
  - Player `player@demo.smartranking` / `Player123!`
- Re-run safe in dev; for prod only run against disposable environments.

## Build & Deploy Workflow
- The dev watcher (`npm run start:dev`) writes into `dist/`; stop it with `Ctrl+C` before building.
- Build scripts use `npx nest` so no global Nest CLI install is required.
- Use the new clean helper to avoid ENOTEMPTY errors: `npm run clean` followed by `npm run build` (the build script already runs clean first).
- If you must rebuild while the watcher is running, kill the watcher or remove `dist/` manually; otherwise the Nest CLI cannot clear the folder.

## Incident Flow
1. Hit `/health` and `/ready` to confirm infra.
2. Inspect logs filtered by `requestId` from the client error.
3. Check audit trail (`audit.event`) to see recent mutations on the entity.
4. Validate indexes (especially after migrations) via `mongosh`.
5. If data drift occurs, rerun `npm run seed:dev` on staging to reproduce with deterministic data.
