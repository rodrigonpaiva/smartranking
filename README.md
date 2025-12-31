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
PORT=8080
```

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
- `GET /me` (optional auth)
- `POST /profiles` (system_admin only)
- `POST /profiles/self` (public route, but requires a valid session; used by signup to create club/player profile)

If no profiles exist, the first admin can be bootstrapped by posting a `system_admin` profile to `/api/v1/users/profiles` (requires a valid session and no existing profiles).

## Tenancy

All routes accept a tenant:
- Header: `x-tenant-id: <tenant>`
- Query: `?tenant=<tenant>`

Default tenant is `default`. `system_admin` GETs without tenant and without club scoping disable tenancy for that request.

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
- `GET /matches/by-category/:categoryId` (system_admin, club, player)
- `GET /matches/ranking/:categoryId` (system_admin, club, player)

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
```
