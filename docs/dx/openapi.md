# OpenAPI / Swagger

The API exposes a Swagger UI backed by a static OpenAPI document so developers
can explore endpoints without additional tooling. Both the OpenAPI JSON and the
Postman collection are generated from the running Nest application.

- **Docs URL:** `http://localhost:8080/docs`
- **Spec URL:** `http://localhost:8080/docs/swagger.json`
- **Auth:** use the Better Auth session cookie (`better-auth.session-token`)
- **Tenant:** add the `x-tenant-id` header on every protected request (Swagger UI
  shows a custom header input in the Authorize modal)
- **Postman:** `postman/smartranking-api.postman_collection.json` (regenerated
  via `npm run contracts`)

## Usage

1. Run the API locally (`npm run start:dev`) or the production build.
2. Visit `/docs`. The page loads Swagger UI from the hosted OpenAPI spec.
3. Click **Authorize** and provide:
   - Cookie: `better-auth.session-token=<value>`
   - Header `x-tenant-id`: e.g., the seeded club ID printed by `npm run seed`
4. Execute requests directly from the UI.
5. To refresh the static artifacts:
   1. Run the API locally.
   2. Fetch `http://localhost:8080/docs-json` and overwrite
      `docs/openapi/smartranking-openapi.json`.
   3. Run `npm run contracts` to convert the OpenAPI file into the matching
      Postman collection at `postman/smartranking-api.postman_collection.json`.

The spec is stored at `docs/openapi/smartranking-openapi.json`. Update it when new
endpoints are added or contracts change.
