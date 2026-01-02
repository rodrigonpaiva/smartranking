# MongoDB Index Plan

Each tenant-scoped collection defines indexes that align with the API’s read
patterns. Indexes assume the tenancy plugin injects `tenant` automatically
into every query.

## Clubs

| Index | Purpose |
| --- | --- |
| `{ tenant: 1, slug: 1 } (unique)` | Fast lookup when creating/updating clubs by slug |
| `{ tenant: 1, name: 1 }` | Listing/searching clubs alphabetically in a tenant |
| `{ tenant: 1, createdAt: -1 }` | Recent clubs view |

## Players

| Index | Purpose |
| --- | --- |
| `{ tenant: 1, clubId: 1, email: 1 } (unique)` | Prevent duplicate emails per club/tenant |
| `{ tenant: 1, clubId: 1, name: 1 }` | Club roster ordering/search |
| `{ tenant: 1, phone: 1 }` | Direct phone lookups |
| `{ tenant: 1, email: 1 }` | Admin email lookups across clubs |
| `{ tenant: 1, createdAt: -1 }` | Recent player lists |

## Categories

| Index | Purpose |
| --- | --- |
| `{ tenant: 1, clubId: 1, category: 1 } (unique)` | Category code uniqueness per club |
| `{ tenant: 1, clubId: 1, createdAt: -1 }` | Roster/category listings |
| `{ tenant: 1, category: 1 }` | Admin lookups by category code |

## Matches

| Index | Purpose |
| --- | --- |
| `{ tenant: 1, clubId: 1, categoryId: 1 }` | Validations linking matches to category/club |
| `{ tenant: 1, categoryId: 1, playedAt: -1 }` | Ranking/history views per category |
| `{ tenant: 1, clubId: 1, playedAt: -1 }` | Match feeds per club |
| `{ tenant: 1, 'participants.playerId': 1, playedAt: -1 }` | Player-specific history queries |

## User Profiles

| Index | Purpose |
| --- | --- |
| `{ tenant: 1, userId: 1 }` | Fast profile lookup for GET /users/me |
| `{ tenant: 1, clubId: 1 }` | Moderator listings per club |
| `{ tenant: 1, playerId: 1 }` | Linking player profile to user profile |

## Validation

Use `db.collection.getIndexes()` in Mongo Shell or Compass to confirm the
indexes exist. To inspect query plans locally, run `db.collection.explain().find(...)`
with representative filters (remember to include `tenant`).
