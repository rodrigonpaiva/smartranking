# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds application code; `main.ts` bootstraps Nest and listens on `PORT` (default `8080`).
- Modules live under feature folders; current module is `players/` with controller, DTOs, and interfaces.
- `test/` contains Jest e2e specs and config; `dist/` is the compiled output (do not edit).
- Prefer new modules per domain (e.g., `matches/`, `rankings/`) with their own `*.module.ts`, controllers, services, and DTOs.

## Build, Test, and Development Commands
- `npm run start:dev` — start the API with hot reload for local development.
- `npm run start` — start once (useful for quick smoke tests).
- `npm run start:prod` — run the compiled output from `dist/`.
- `npm run build` — compile TypeScript via Nest CLI to `dist/`.
- `npm test` / `npm run test:watch` — run Jest unit/integration tests.
- `npm run test:e2e` — run e2e tests from `test/`.
- `npm run test:cov` — generate coverage into `coverage/`.
- `npm run lint` — ESLint with auto-fix; `npm run format` — Prettier across `src/` and `test/`.

## Coding Style & Naming Conventions
- TypeScript, 2-space indentation, ES module imports.
- DTOs and interfaces in `dtos/` and `interfaces/` folders; name with `*.dto.ts` and `*.interface.ts`.
- Controllers use kebab-case routes (e.g., `api/v1/players`); service methods use verbs (`createPlayer`, `findAll`).
- Run `npm run lint && npm run format` before pushing to keep style consistent.

## Testing Guidelines
- Framework: Jest with `ts-jest`; e2e tests use Supertest.
- Name tests `*.spec.ts` alongside code or under `test/`.
- For new endpoints, add both unit tests (controller/service) and e2e coverage of happy and failure paths.
- Keep coverage meaningful; avoid skipping tests unless justified in the PR description.

## Commit & Pull Request Guidelines
- Use clear, imperative commits; Conventional Commits are preferred (`feat: add player creation validation`, `fix: handle missing email`).
- Pull requests should include a short summary, testing evidence (`npm test`, `npm run lint`), and linked issue/goal when applicable.
- Add screenshots or sample requests/responses for API changes (e.g., `POST /api/v1/players` payload).
- Keep PRs scoped: one feature or fix per PR; include migration steps if the change affects configuration or data.

## Security & Configuration Tips
- Avoid committing secrets; rely on environment variables (e.g., `PORT`, future DB credentials). Provide `.env.example` updates when adding new variables.
- Validate and sanitize incoming data in controllers/services; add DTO validation pipes when fields are required.
