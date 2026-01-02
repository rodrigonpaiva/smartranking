# Role-Based Access Control (RBAC)

SmartRanking enforces RBAC through Better Auth sessions, tenant-aware
guards, and scoped Mongoose queries. Guards emit:

- `401` – missing/invalid Better Auth session
- `400` – authenticated but missing `x-tenant-id`
- `403` – authenticated but forbidden (role or scope)

All responses respect the global error envelope:
`{ timestamp, path, error: { statusCode, message } }`.

## Roles

- `system_admin` – fleet administration within the selected tenant (one tenant per request via `x-tenant-id`).
- `club` – operations restricted to `profile.clubId` and the matching tenant.
- `player` – read-only access to their own profile/results; no admin endpoints.

## Permission Matrix

Legend: ✅ allowed, 🚫 forbidden. Scoped actions include additional notes.

### Users & Profiles (`/api/v1/users`)

| Endpoint | system_admin | club | player | Notes |
| --- | --- | --- | --- | --- |
| `GET /users/me` | ✅ | ✅ | ✅ | Sessions required; returns `{ user, profile }`. Users without profiles still receive `profile: null`. |
| `POST /users/profiles` | ✅ | 🚫 | 🚫 | Adds or updates any profile. Only admins may assign moderators or elevate roles. |
| `POST /users/profiles/self` | ✅ | ✅ | ✅ | Auth required. Used by signup to create club/player profiles. Body `clubId` must match tenant; `role` limited to `club`/`player`. |

### Clubs (`/api/v1/clubs`)

| Endpoint | system_admin | club | player | Notes |
| --- | --- | --- | --- | --- |
| `GET /clubs` | ✅ tenant-wide | ✅ own club only | 🚫 | Club roles only receive their own record. |
| `GET /clubs/:id` | ✅ | ✅ (own clubId) | 🚫 | Club access denied if requesting another club. |
| `POST /clubs` | ✅ | 🚫 | 🚫 | Creates new club/tenant. |
| `PUT /clubs/:id` | ✅ | 🚫 | 🚫 | Only admins may update/delete clubs. |
| `DELETE /clubs/:id` | ✅ | 🚫 | 🚫 |  |
| `GET /clubs/public` | Public | Public | Public | Small `{ _id, name }` list for signup. |

### Players (`/api/v1/players`)

| Endpoint | system_admin | club | player | Notes |
| --- | --- | --- | --- | --- |
| `GET /players` | ✅ tenant-wide | ✅ scoped to `profile.clubId` | 🚫 | Club roles receive only their roster. |
| `GET /players/by-club/:clubId` | ✅ any club | ✅ own club | ✅ own club | Player role limited to own club roster. |
| `GET /players/by-email` / `by-phone` / `:id` | ✅ | ✅ (own club) | 🚫 | Access denied if target player belongs to another club. |
| `POST /players` | ✅ | ✅ (forced `clubId = profile.clubId`) | 🚫 | Body `clubId` ignored for club role. |
| `PUT /players/:id` | ✅ | ✅ (own club players only) | 🚫 | |
| `DELETE /players/:id` | ✅ | ✅ (own club players only) | 🚫 | |
| `GET /players/search` | ✅ | ✅ (forced to own club) | 🚫 | |

### Categories (`/api/v1/categories`)

| Endpoint | system_admin | club | player | Notes |
| --- | --- | --- | --- | --- |
| `GET /categories` | ✅ tenant-wide | ✅ own club | 🚫 | |
| `GET /categories/:category` | ✅ | ✅ own club | 🚫 | |
| `GET /categories/my` | 🚫 | 🚫 | ✅ | Requires `profile.playerId`; shows categories linked to the player. |
| `POST /categories` | ✅ | ✅ (forced `clubId = profile.clubId`) | 🚫 | |
| `PUT /categories/:category` | ✅ | ✅ own club | 🚫 | |
| `POST /categories/:category/players/:playerId` | ✅ | ✅ own club | 🚫 | Category + player must belong to same club. |

### Matches & Ranking (`/api/v1/matches`)

| Endpoint | system_admin | club | player | Notes |
| --- | --- | --- | --- | --- |
| `POST /matches` | ✅ | ✅ (forced `clubId = profile.clubId`) | 🚫 | Category/club IDs validated against scope. |
| `GET /matches` | ✅ tenant-wide | ✅ own club | 🚫 | |
| `GET /matches/by-category/:categoryId` | ✅ | ✅ own club | ✅ only matches containing the player | Results filtered to participant matches when role = player. |
| `GET /matches/ranking/:categoryId` | ✅ | ✅ own club | 🚫 | Ranking is an admin/club view only. |

## Access Context & Scoping

`AccessContextGuard` resolves the authenticated user’s profile once per request,
validates `x-tenant-id`, and attaches `req.accessContext = { userId, role, tenantId, clubId, playerId }`.
Controllers/services rely on this context to enforce scoping:

- **Club role** – `clubId` is mandatory; controllers/services refuse operations targeting other clubs and override incoming `clubId` fields.
- **Player role** – never hits admin routes; only results endpoints consult `playerId` and filter data to matches containing the player.
- **System admin** – selects a tenant via `x-tenant-id` and may operate on any resource inside that tenant.

Violations (e.g., club accessing another club’s roster, player requesting ranking) return `403` with the standardized error envelope.
