# Ranking System

The SmartRanking API uses a deterministic ELO-based rating that is fully recomputed from match history every time a ranking is requested. No persisted snapshots exist—`GET /api/v1/matches/ranking/:categoryId` retrieves all matches belonging to the category, sorts them by `playedAt` (then `createdAt`), and replays each result in chronological order. Rebuilding the table is idempotent, so seeding or rebuilding a category simply requires replaying the already stored matches.

## Base Rules

- **Initial rating**: every player starts at 1500 in each category.
- **Formats**: singles and doubles are supported.
  - Singles teams contain 1 player; doubles teams contain 2 players.
  - Team rating = the average of its members’ current rating at the time of the match.
- **K-factor**:
  - Singles: 32
  - Doubles: 24 (lower to soften rating swings on shared teams)
- **Result scores**: WIN = 1, DRAW = 0.5, LOSS = 0.
- **ELO update**:
  - `expected = 1 / (1 + 10 ** ((opponentRating - teamRating) / 400))`
  - `delta = K * (actual - expected)`
  - Each team member receives the same `delta` and their stats (wins/losses/draws/matches) are incremented.
- **Draws**: allowed for tied results; both teams receive `actual = 0.5`.
- **Precision**: player ratings are rounded to two decimals in responses, but the internal replay keeps floating‑point precision for determinism.

## Endpoint Contract

`GET /api/v1/matches/ranking/:categoryId` now returns, per player:

```json
{
  "_id": "player-id",
  "name": "Player Name",
  "clubId": "club-id",
  "email": "player@example.com",
  "phone": "11999999999",
  "pictureUrl": "",
  "rating": 1512.34,
  "position": 1,
  "wins": 5,
  "losses": 1,
  "draws": 0,
  "matches": 6,
  "lastMatchAt": "2025-01-01T12:00:00.000Z"
}
```

Players are ordered by rating (desc) and `position` reflects this order. Only players that have participated in at least one match for the category are shown.

## Reprocessing Guarantee

Because rankings are recomputed on-the-fly from match history, administrators can rebuild a category’s ranking at any time without extra storage. Adding or editing matches automatically affects the next ranking request. For nightly or manual audits you can simply re-run `GET /api/v1/matches/ranking/:categoryId`—no background jobs are required.

## Doubles Considerations

- Teammates share the same rating delta per match; their personal ratings continue to diverge as they pair with different teammates in subsequent matches.
- When doubles teams face singles or bye situations (shouldn’t happen via validation), the service falls back to the average rating of the players present.
- Validation continues to enforce one or two players per team depending on the declared format, ensuring padel-friendly behavior.
