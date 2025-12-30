# SmartRanking API

NestJS 11 + MongoDB service that now manages both players and their categories. CRUD flows are validated through DTOs, persisted with Mongoose schemas, and wrapped by a global exception filter for consistent error payloads.

## What’s Inside

- NestJS modules for **Players** and **Categories**, wired together so a category can reference existing players.
- Global config via `@nestjs/config`; MongoDB connection uses `MONGODB_URI` and `MONGODB_DB_NAME`.
- Global `AllExceptionsFilter` standardizes error responses; a custom `ValidationParamPipe` guards route params from being empty.
- MongoDB schemas: `Player` (email, phone, name, ranking defaults) and `Category` (unique category code, description, events array, player refs).
- Development scripts for build, lint, format, and the Nest watch server.

## Requirements

- Node.js 20+
- npm 10+
- MongoDB instance (local or Atlas) reachable from your machine.

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

`ConfigModule` loads these at startup. The HTTP server defaults to `PORT` or 8080.

## Run Locally

```bash
npm install
npm run start:dev   # watch mode
```

The API will be available at `http://localhost:8080`.

## API

Base path: `/api/v1`

### Tenancy

All routes accept a tenant via header or query param:

- Header: `x-tenant-id: <tenant>`
- Query: `?tenant=<tenant>`

If no tenant is provided, the default tenant is `default`.

### Players

- `POST /players` – Create a player. Body: `email`, `phone`, `name` (email must be unique).
- `GET /players` – List all players.
- `GET /players/:_id` – Fetch a player by Mongo `_id`.
- `GET /players/by-phone?phone=<value>` – Fetch by phone number.
- `GET /players/by-email/:email` – Intended email lookup (the route currently lacks the `:email` param in the decorator; add it before relying on this endpoint).
- `PUT /players/:_id` – Update `phone` and `name` of an existing player.
- `DELETE /players/:_id` – Remove a player.

### Categories

- `POST /categories` – Create a category with `category`, `description`, and at least one `events` entry (`name`, `operation`, `value`).
- `GET /categories` – List categories (populates `players`).
- `GET /categories/:category` – Fetch a category by its code.
- `PUT /categories/:category` – Update description or events.
- `POST /categories/:category/players/:playerId` – Assign an existing player to a category; errors if the player is missing or already assigned.

### Auth (Better Auth)

Base path: `/api/auth`

- `POST /sign-up/email` – Create a user with `email`, `password`, `name`.
- `POST /sign-in/email` – Sign in with `email` and `password`.
- `GET /get-session` – Returns the current session and user (requires cookie).

**Error shape**
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

## Security Tests

Run the security-focused e2e suite:

```bash
npm run test:e2e
```

Scope covered in `test/security.e2e-spec.ts`:

- Auth surface availability (Better Auth routes respond)
- Input validation for DTO payloads
- NoSQL injection resistance for query params
- Rate limiting behavior (tested via auth endpoints)
- CORS behavior for trusted vs. untrusted origins

## Notes & Next Steps

- The e2e scaffold still targets a `GET /` “Hello World” endpoint that does not exist; update tests when real routes are ready.
- Consider enabling a global `ValidationPipe` in `main.ts` to avoid per-route decorators and to enforce payload stripping/transform.
- Add DTO-level validation for category assignments (currently validated implicitly by service checks).
- Add pagination/filtering to player and category listings once the dataset grows.
