# SmartRanking API

Sample NestJS application that manages SmartRanking players. The API exposes REST endpoints to register and list players, applies automatic validation, and stores data in memory (perfect for learning or quick prototypes).

## Table of Contents
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Available Scripts](#available-scripts)
- [Routes](#routes)
- [Decisions & Next Steps](#decisions--next-steps)

## Architecture
- **NestJS 11 + TypeScript** with a global `ValidationPipe` in `src/main.ts` to ensure sanitized payloads.
- **PlayersModule** hosts controller, service, DTO, and interface (`src/players`). Data lives in memory inside `PlayersService`, and each player receives a `_id` generated with `uuid`.
- **Validation** is handled by `class-validator` in `CreatePlayerDto`, guaranteeing valid `email`, `phone`, and `name` before hitting the service layer.

## Prerequisites
- Node.js 20+ (any version supported by Nest 11 works).
- npm 10+.

## Installation
```bash
npm install
```

## Available Scripts
```bash
npm run start       # start in development mode
npm run start:dev   # start with watch mode
npm run start:prod  # run the compiled build from dist/
npm run build       # compile TypeScript sources
npm run test        # execute unit tests (none defined yet)
npm run lint        # lint and auto-fix issues
```

## Routes
Default base URL: `http://localhost:8080/api/v1`.

### Create or update a player
- **POST** `/players`
- Request body:
```json
{
  "email": "player@email.com",
  "phone": "+55 11 99999-8888",
  "name": "Jane Doe"
}
```
- Behavior: if the `email` already exists, only `name` is updated; otherwise a new player is created with ranking `A`.

### List players
- **GET** `/players`
- Returns the in-memory array of players.

## Decisions & Next Steps
- In-memory storage is convenient for demos but loses data on every restart. Replace it with a real persistence layer (MongoDB, Postgres, etc.) and make service methods truly asynchronous before production use.
- The upsert flow (`PlayersService.refresh`) currently updates only the name. Consider extending it to phone, ranking, and picture, or reject unsupported updates.
- No tests have been written even though Jest configs (`test` and `test:e2e`) are ready; add specs for the service and controller.
- Controllers do not return the created entity or explicit status codes. Add DTOs for responses and proper HTTP status handling, plus structured error responses, to make the API production-ready.
