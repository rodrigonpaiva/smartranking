# Quickstart – Club Happy Path

This guide shows the minimal steps a club administrator performs through the SmartRanking API. Use the Postman collection under `postman/smartranking-api.postman_collection.json` or the equivalent HTTP calls below. All requests include `x-tenant-id` (use the seeded club ID) unless noted otherwise.

1. **Sign up / authenticate**
   - Use Better Auth (`/api/auth/sign-up/email` then `/api/auth/sign-in/email`).
   - The resulting session cookie will be automatically forwarded by the Postman collection.

2. **Create a club**
   ```http
   POST /api/v1/clubs
   {
     "name": "Padel Club",
     "slug": "padel-club",
     "city": "São Paulo",
     "state": "SP"
   }
   ```
   Save the returned `_id` as `clubId`.

3. **Create a category**
   ```http
   POST /api/v1/categories
   {
     "category": "A",
     "description": "Advanced",
     "events": [],
     "clubId": "<clubId>"
   }
   ```
   Store `categoryId` for later.

4. **Create players**
   ```http
   POST /api/v1/players
   {
     "name": "Alice",
     "email": "alice@example.com",
     "phone": "11999999999",
     "clubId": "<clubId>"
   }
   ```
   Repeat for each player. Players automatically inherit the current tenant.

5. **Assign players to the category**
   ```http
   POST /api/v1/categories/<category>/players/<playerId>
   ```
   This ensures the matchmaking validation accepts them.

6. **Submit a match**
   ```http
   POST /api/v1/matches
   {
     "clubId": "<clubId>",
     "categoryId": "<categoryId>",
     "format": "SINGLES",
     "bestOf": 3,
     "decidingSetType": "STANDARD",
     "teams": [
       { "players": ["<playerA>"] },
       { "players": ["<playerB>"] }
     ],
     "sets": [
       {
         "games": [
           { "teamIndex": 0, "score": 6 },
           { "teamIndex": 1, "score": 3 }
         ]
       },
       {
         "games": [
           { "teamIndex": 0, "score": 6 },
           { "teamIndex": 1, "score": 4 }
         ]
       }
     ]
   }
   ```
   The payload validates sets, tiebreaks, and team composition before persisting. Domain log entries for `match.created` and `match.confirmed` will appear in the application logs.

7. **Fetch the ranking**
   ```http
   GET /api/v1/matches/ranking/<categoryId>
   ```
   The response lists each player with their ELO rating, win/loss/draw counts, match totals, and the date of the last match. Rankings are fully reprocessed from match history on every call.

Follow this flow to onboard any new club. For automation, the `npm run seed` command can bootstrap a local dataset for immediate testing.
