# SmartRanking API

SmartRanking is a NestJS 11 service that manages player records for an amateur ranking application. It exposes REST endpoints to create, update, list, and delete players, validates payloads through DTOs, and persists data in MongoDB via Mongoose.

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Environment & Configuration](#environment--configuration)
- [Development Commands](#development-commands)
- [Running & Testing](#running--testing)
- [API Reference](#api-reference)
- [Contributor Resources](#contributor-resources)
- [Decisions & Next Steps](#decisions--next-steps)

## Architecture

- **NestJS 11 + TypeScript** bootstrapped in `src/main.ts` with a global `ValidationPipe` configured for whitelist, forbidNonWhitelisted, and transformation.
- **Configuration layer** powered by `@nestjs/config` (`ConfigModule.forRoot` + global scope) feeds secrets to providers using `ConfigService.getOrThrow`.
- **MongoDB persistence** is established via `MongooseModule.forRootAsync`, while feature schemas are registered inside their modules (e.g., `PlayersModule`).
- **Players module** (`src/players`) keeps controller, service, DTOs, schema, and interface in dedicated folders, enabling clear dependency injection boundaries.
- **Class validation + DTOs** ensure `email`, `phone`, and `name` are present before touching the database.

## Prerequisites

- Node.js 20+
- npm 10+
- Access to a MongoDB instance (local or Atlas).

## Installation

```bash
npm install
```

## Getting Started

1. Copy the example environment file and fill in credentials: `cp .env.example .env`.
2. Update `MONGODB_URI` to point to your Mongo cluster (local or Atlas) and set a `PORT` if 3000 is taken.
3. Install dependencies (`npm install`), then run `npm run start:dev` to launch the API at `http://localhost:3000`.
4. Hit the endpoints listed below or use `curl`/Thunder Client to verify connectivity before building features.

## Environment & Configuration

Copy `.env.example` to `.env` and replace the placeholder values with your real credentials:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster/<db>
PORT=3000
```

Variables are loaded via `@nestjs/config`, so they apply to `start`, `start:dev`, and compiled builds alike. Keep `.env` files untracked (already handled in `.gitignore`). When deploying, set the same variables in your platform or secrets vault.

## Development Commands

```bash
npm run start         # start the compiled app (uses dist/)
npm run start:dev     # watch mode for local development
npm run start:debug   # watch mode with inspector enabled
npm run start:prod    # run dist/main.js (after build)
npm run build         # compile TypeScript via Nest CLI
npm run lint          # run ESLint with Prettier integration
npm run format        # auto-format src/ and test/
npm test              # execute Jest unit tests
npm run test:watch    # watch mode for tests
npm run test:cov      # produce coverage report in coverage/
npm run test:e2e      # run e2e tests defined in test/jest-e2e.json
```

## Running & Testing

1. Start MongoDB and set the `MONGODB_URI` (or keep the default Atlas string while experimenting).
2. Run `npm run start:dev` to serve the API on `http://localhost:3000` (or the configured `PORT`).
3. Run code quality checks: `npm run lint` (fix warnings) and the Jest suites (`npm test`, `npm run test:e2e`) before pushing. Failing tests or lint errors should block merges.

## API Reference

Base URL (default): `http://localhost:3000/api/v1/players`

| Method & Path | Description | Notes |
| --- | --- | --- |
| `POST /api/v1/players` | Creates a player or updates the existing one by `email`. | Body requires `email`, `phone`, and `name`. When the email already exists, the service updates the record with the provided fields. |
| `GET /api/v1/players` | Lists all players. | Returns the entire collection with no filtering (add pagination as needed). |
| `GET /api/v1/players/email/:email` | Returns a single player by email. | Throws 404 if the player is missing. |
| `GET /api/v1/players/phone/:phone` | Returns a single player by phone. | Unique constraint enforced at the schema level. |
| `DELETE /api/v1/players/email/:email` | Removes the player registered with the given email. | Returns 404 when the player does not exist. |

Example request:

```bash
curl -X POST http://localhost:3000/api/v1/players \
  -H "Content-Type: application/json" \
  -d '{"email":"player@email.com","phone":"+55 11 99999-8888","name":"Jane Doe"}'
```

## Contributor Resources

- **AGENTS.md** – contributor playbook covering structure, commands, style, and workflow tips. Start there if you are onboarding or opening PRs.
- **NestJS docs** – https://docs.nestjs.com offers deeper explanations for modules, providers, and testing patterns referenced here.

## Decisions & Next Steps

- **Validation coverage:** add DTOs for update/delete operations and consider response DTOs to avoid leaking Mongoose documents.
- **Configuration:** externalize additional secrets (e.g., analytics keys) and document required environment variables alongside `.env.example` whenever new modules are introduced.
- **Testing:** currently only the default e2e scaffold exists. Add unit tests for `PlayersService` CRUD flows and controller integration tests hitting the database (or mocking the model).
- **Error handling:** standardize HTTP responses (status codes + message body) and include validation error shapes for frontend consumers.
- **Filtering & pagination:** enhance the listing endpoint with pagination parameters and query-based filtering to make the API more scalable.
