# SmartRanking API

NestJS 11 + MongoDB API that manages clubs, players, categories, matches, and user profiles. The API uses Better Auth for sessions, role-based access control, and a global exception filter to standardize error responses.

## Stack

- NestJS 11 + Mongoose
- Better Auth (email/password, cookie sessions)
- Tenancy middleware + plugin (tenant-aware queries)

## Requirements

- Node.js 20+
- npm 10+
- MongoDB instance reachable from your machine

## Environment

Create `.env` from the sample and adjust values:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/smartranking
MONGODB_DB_NAME=smartranking
BETTER_AUTH_SECRET=your-32-char-secret
BETTER_AUTH_URL=http://localhost:8080
BETTER_AUTH_RATE_LIMIT_MAX=100
BETTER_AUTH_RATE_LIMIT_WINDOW=60
BETTER_AUTH_COOKIE_SAMESITE=lax
# optional cookie overrides
# BETTER_AUTH_COOKIE_DOMAIN=.example.com
# BETTER_AUTH_DISABLE_ORIGIN_CHECK=false
FRONTEND_URL=http://localhost:5173
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=120
AUTH_RATE_LIMIT_TTL=60
AUTH_RATE_LIMIT_MAX=10
PORT=8080
```

See `docs/security/hardening.md` for a complete description of the security
defaults and how to tune them per environment.

## Run Locally

```bash
npm install
npm run start:dev
```

The API runs at `http://localhost:8080`.

## Auth, Roles, and Profiles

Roles:
- `system_admin`
- `club`
- `player`

Better Auth base path: `/api/auth`
- `POST /sign-up/email`
- `POST /sign-in/email`
- `GET /get-session`

User profiles (base: `/api/v1/users`):
- `GET /me` (optional auth, returns `{ id, email, role, tenantId, profile }`; authenticated users without a profile receive `403 User profile not configured`)
- `POST /profiles` (system_admin only)
- `POST /profiles/self` (public route, but requires a valid session; used by signup to create club/player profile)

If no profiles exist, the first admin can be bootstrapped by posting a `system_admin` profile to `/api/v1/users/profiles` (requires a valid session and no existing profiles).

## Tenancy

Protected routes require the `x-tenant-id` header. The value must be a non-empty slug/ObjectId that identifies the active tenant (usually the club `_id`). The middleware stores the tenant on `req.tenantId` and inside an `AsyncLocalStorage` scope that powers the Mongoose tenancy plugin.

- `system_admin` requests use the header to select a tenant. If the payload already references a `clubId`, that field is used as a fallback when the header is missing.
- `club` / `player` roles must always send a tenant header that matches their profile club. Mismatches raise `403`, and missing headers raise `400 Tenant header is required`.
- Public routes (`/auth`, `/users/profiles/self`, `/clubs/public`, `/health`) skip tenant enforcement entirely.

There is no query-string fallback and no default tenant anymore—omitting the header on a protected route always produces a `400` unless the handler is one of the documented fallbacks for system administrators. All MongoDB documents inherit the current tenant via the plugin, so cross-tenant reads are prevented by default.

## OpenAPI & Collections

- Swagger UI: `http://localhost:8080/docs`
- Spec JSON: `http://localhost:8080/docs/swagger.json`
- Postman collection: `postman/smartranking-api.postman_collection.json`
- Refresh flow: fetch `/docs-json` into `docs/openapi/smartranking-openapi.json`
  and run `npm run contracts` to update the Postman collection

Swagger exposes both the Better Auth cookie and the `x-tenant-id` header in the
Authorize modal. The generated Postman collection includes collection variables
(`baseUrl`, `tenantId`, `sessionToken`, `clubId`) that map to request headers.
More contract details live in `docs/dx/api-contracts.md`.

## Dev Bootstrap & Seeds

Run `npm run seed` to bootstrap a realistic tenant:

- Club: `Demo Tennis & Padel Club`
- Tenant alias: `tenant_demo`
- Tenant header: equals the club `_id` printed after seeding
- Users / passwords:
  - `admin@demo.smartranking` / `Admin123!`
  - `club@demo.smartranking` / `Club123!`
  - `player@demo.smartranking` / `Player123!`
- Sample players, categories, and matches are created so ranking endpoints have
  data out of the box

After seeding, sign in via `POST /api/auth/sign-in/email`, copy the
`better-auth.session-token` cookie into the Postman `sessionToken` collection
variable (or the Swagger authorize dialog), and set `x-tenant-id` to the seeded
club ID.

## API (Base `/api/v1`)

### Clubs

- `POST /clubs` (system_admin) create club
- `GET /clubs` (system_admin, club) list clubs
- `GET /clubs/public` (public) list `{ _id, name }` for signup
- `GET /clubs/:_id` (system_admin, club) fetch by id
- `PUT /clubs/:_id` (system_admin) update
- `DELETE /clubs/:_id` (system_admin) delete

### Players

- `POST /players` (system_admin, club) create player
- `GET /players` (system_admin, club) list players
- `GET /players/search?q=<term>&clubId=<id>` (system_admin, club) search by name/email, limit 20
- `GET /players/by-club/:clubId` (system_admin, club, player) list by club
- `GET /players/by-email/:email`
- `GET /players/by-phone?phone=<value>`
- `GET /players/:_id`
- `PUT /players/:_id`
- `DELETE /players/:_id`

### Categories

- `POST /categories` (system_admin, club) create category
- `GET /categories` (system_admin, club) list categories (populates players)
- `GET /categories/my` (player) list categories for the current player
- `GET /categories/:category` (system_admin, club) fetch by code
- `PUT /categories/:category` (system_admin, club) update
- `POST /categories/:category/players/:playerId` (system_admin, club) assign player to category

### Matches & Ranking

Match create payload:
- `categoryId`, `clubId`
- `format`: `SINGLES` | `DOUBLES`
- `bestOf` (odd number)
- `decidingSetType`: `STANDARD` | `ADVANTAGE` | `SUPER_TIEBREAK_7` | `SUPER_TIEBREAK_10`
- `teams`: 2 items, each `{ players: string[] }`
- `sets`: list of `{ games: [{ teamIndex, score }], tiebreak?: [{ teamIndex, score }] }`

Endpoints:
- `POST /matches` (system_admin, club)
- `GET /matches` (system_admin, club)
- `GET /matches/by-category/:categoryId` (system_admin, club, player) – accepts
  `page`, `limit`, `from`, `to`
- `GET /matches/ranking/:categoryId` (system_admin, club)

### Errors

All uncaught errors return:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "path": "/api/v1/players/123",
  "error": { "statusCode": 404, "message": "..." }
}
```

## Development Commands

```bash
npm run start         # serve compiled dist
npm run start:dev     # dev watch
npm run start:debug   # dev watch + inspector
npm run start:prod    # run dist/main.js
npm run build         # compile TypeScript
npm run lint          # eslint with --fix
npm run format        # prettier on src/ and test/
npm test              # jest unit tests
npm run test:watch
npm run test:cov
npm run test:e2e
npm run audit:prod    # npm audit for production dependencies
```
