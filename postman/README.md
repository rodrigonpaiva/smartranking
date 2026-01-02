# Postman Collection

Import `smartranking-api.postman_collection.json` (root `postman/` folder). The
collection is generated from the OpenAPI spec via `npm run contracts` and
already defines collection variables:

- `baseUrl` – defaults to `http://localhost:8080`
- `tenantId` – set to the seeded club ID printed by `npm run seed`
- `sessionToken` – Better Auth session cookie (copy the
  `better-auth.session-token` value after calling
  `POST /api/auth/sign-in/email`)
- `clubId` – optional helper for body payloads

Every request automatically injects the `x-tenant-id` header and the `Cookie`
header using these variables, so updating the values once per session is
enough.

Recommended flow:

1. Run `npm run seed` to provision demo data and note the tenant header.
2. Call `POST /api/auth/sign-in/email` with the seeded credentials
   (see `README`). Copy the `better-auth.session-token` cookie from the
   response into the `sessionToken` collection variable.
3. Hit `GET /api/v1/clubs/public` (no auth) or any protected route. All
   protected calls require the session cookie + tenant header.
