# Plan: Migrate syncOdds to SportsGameOdds SDK

## TL;DR
Replace the old `odds-api-io` client and the partially-started `sports-odds-api` usage in `syncOdds2.ts` with a correct, API-call-efficient implementation using the SportsGameOdds SDK (`sports-odds-api` npm package). The SDK is already in `package.json` but the current `syncOdds2.ts` uses a completely wrong API surface (methods like `client.getEvents()` and `client.getEventOdds()` don't exist). The real SDK uses `client.events.get()` with a totally different data model (oddID-keyed odds embedded in each event, no separate odds endpoint needed).

## Key Research Findings

### Current State
- **`syncOdds.ts`** — Uses the `odds-api-io` package (old client). Called from `cron.ts` (`/sync-odds`) and `games.ts` (`/api/games`).
- **`syncOdds2.ts`** — Attempted migration to `sports-odds-api` but uses **wrong API methods** (`client.getEvents()`, `client.getEventOdds()`). These don't exist on the SDK. Currently **not imported anywhere** — dead code.
- **`odds.ts`** — Contains `parseEventOdds()` which parses the old API's response format (bookmakers → markets → odds arrays with `hdp`, `home`, `away`, `over`, `under` fields). This will need a **complete rewrite** for the new SDK's data model.
- **`cron.ts`** — Imports `syncOdds` from `./syncOdds` (the old one).
- **`games.ts`** — Imports `syncOdds` from `./syncOdds.js` (the old one).

### SportsGameOdds SDK — Correct API Surface
- **Package**: `sports-odds-api` v1.3.0 (already in `server/package.json`)
- **Client init**: `new SportsGameOdds({ apiKeyHeader: process.env.SPORTS_ODDS_API_KEY_HEADER })`
  - Alternative: `apiKeyParam` (default env var is `SPORTS_ODDS_API_KEY_HEADER`)
- **Fetching events**: `client.events.get({ sportID: 'BASKETBALL', leagueID: 'NCAAB', ... })`
  - Returns paginated `EventsNextCursorPage` — use `for await (const event of client.events.get(...))` for auto-pagination
  - Or single page: `const page = await client.events.get(...)` then `page.data`
- **Key query params**:
  - `sportID: 'BASKETBALL'`
  - `leagueID: 'NCAAB'`
  - `started: false` for upcoming, `live: true` for live, `ended: false` for not-ended
  - `oddsAvailable: true` — only events with open odds
  - `bookmakerID: 'draftkings'` — include odds for specific bookmaker(s)
  - `oddID` — filter to specific oddIDs (comma-separated)
  - `limit` — page size (for pagination)

### SportsGameOdds Event Data Model
Each `Event` object contains:
- `eventID` — unique event identifier
- `leagueID` — e.g., "NCAAB"
- `sportID` — e.g., "BASKETBALL"
- `status` — `{ startsAt, started, ended, completed, live, cancelled, displayShort, displayLong }`
- `teams` — `{ home: { names: { short, medium, long }, teamID, score, ... }, away: { ... } }`
- `odds` — **Object keyed by oddID strings**, e.g.:
  - `"points-home-game-ml-home"` — Home moneyline
  - `"points-away-game-ml-away"` — Away moneyline
  - `"points-home-game-sp-home"` — Home spread
  - `"points-away-game-sp-away"` — Away spread
  - `"points-all-game-ou-over"` — Total over
  - `"points-all-game-ou-under"` — Total under

Each odds entry contains:
- `oddID`, `betTypeID`, `sideID`, `statID`, `periodID`, `statEntityID`
- `bookOdds` — consensus odds (string, American format)
- `bookSpread` — consensus spread (string)
- `bookOverUnder` — consensus over/under line (string)
- `byBookmaker` — `{ [bookmakerID]: { odds, spread, overUnder, available, isMainLine, bookmakerID } }`
  - e.g., `byBookmaker.draftkings.odds` = "-110"

### NCAAB Basketball oddIDs We Need
| Market | oddID | What it gives |
|---|---|---|
| Home ML | `points-home-game-ml-home` | `bookOdds` or `byBookmaker.draftkings.odds` |
| Away ML | `points-away-game-ml-away` | `bookOdds` or `byBookmaker.draftkings.odds` |
| Home Spread | `points-home-game-sp-home` | `bookOdds` + `bookSpread` or via byBookmaker |
| Away Spread | `points-away-game-sp-away` | `bookOdds` + `bookSpread` or via byBookmaker |
| Over | `points-all-game-ou-over` | `bookOdds` + `bookOverUnder` or via byBookmaker |
| Under | `points-all-game-ou-under` | `bookOdds` + `bookOverUnder` or via byBookmaker |

### Bookmaker IDs
- DraftKings = `draftkings` (lowercase)
- BetMGM = `betmgm` (lowercase)

### API Call Efficiency (CRITICAL — strict rate limits)
- **One call to `client.events.get()` returns events WITH embedded odds** — no need for separate odds calls per event
- The old code made N+1 calls (1 for events, then 1 per event for odds) — **this is unnecessary and wasteful with the new SDK**
- Use `bookmakerID: 'draftkings'` to filter odds to only DraftKings in the response
- Use `oddID` param to request only the 6 oddIDs we care about (ML, spread, O/U) to reduce response size
- Use pagination carefully — `limit: 50` or similar

### Database Schema (Supabase)
**`games` table**: `id`, `ncaa_game_id`, `home_team`, `away_team`, `start_time`, `game_date`, `status`, `home_score`, `away_score`, etc.
**`odds` table**: `game_id`, `bookmaker`, `home_ml`, `away_ml`, `home_spread`, `home_spread_price`, `away_spread_price`, `over_under`, `over_price`, `under_price`
- Upsert on `game_id,bookmaker` conflict

### Client Types (unchanged)
`OddsRow` expects: `home_ml`, `away_ml`, `home_spread`, `home_spread_price`, `away_spread_price`, `over_under`, `over_price`, `under_price` — all numbers or null. Odds are in American format.

---

## Steps

### Phase 1: Update `syncOdds2.ts` — Rewrite with correct SDK usage
1. **Rewrite client initialization** — use `new SportsGameOdds({ apiKeyHeader: process.env.SPORTS_ODDS_API_KEY_HEADER })`
2. **Fetch events in a single call** with params:
   - `sportID: 'BASKETBALL'`, `leagueID: 'NCAAB'`
   - `ended: false` (upcoming + live games)
   - `oddsAvailable: true`
   - `bookmakerID: 'draftkings'`
   - `oddID: 'points-home-game-ml-home,points-away-game-ml-away,points-home-game-sp-home,points-away-game-sp-away,points-all-game-ou-over,points-all-game-ou-under'`
3. **Iterate events** (use `for await` for auto-pagination or single page if small)
4. **Extract team names** from `event.teams.home.names.short` / `event.teams.away.names.short`
5. **Extract start time** from `event.status.startsAt`
6. **Use `event.eventID`** as `ncaa_game_id`
7. **Upsert into `games` table** (same pattern as before)
8. **Parse odds from `event.odds`** — extract the 6 oddIDs, pull `byBookmaker.draftkings` data
9. **Upsert into `odds` table** (same pattern as before)

### Phase 2: Rewrite `parseEventOdds` in `odds.ts`
1. Replace old `parseEventOdds()` with new function that takes `event.odds` (keyed by oddID) and a bookmakerID
2. Extract: ML odds, spread + spread price, O/U line + prices from `byBookmaker[bookmakerID]`
3. All odds values are strings in the SDK — parse to numbers
4. Return the same shape: `{ bookmaker, home_ml, away_ml, home_spread, home_spread_price, away_spread_price, over_under, over_price, under_price }`

### Phase 3: Update imports in `cron.ts` and `games.ts`
1. Change `import { syncOdds } from '../lib/syncOdds'` → `import { syncOdds2 } from '../lib/syncOdds2'` (or rename function)
2. *Depends on Phase 1*

### Phase 4: Clean up
1. Consider removing or deprecating `syncOdds.ts` (old client) — confirm with user
2. Consider removing `odds-api-io` from `package.json` if no longer needed
3. Remove unused `createRequire` import

---

## Relevant Files
- `server/src/lib/syncOdds2.ts` — **Complete rewrite** (main target)
- `server/src/lib/odds.ts` — Rewrite `parseEventOdds()` for new data model
- `server/src/lib/syncOdds.ts` — Old implementation (to be replaced/removed)
- `server/src/routes/cron.ts` — Update import to use new sync function
- `server/src/routes/games.ts` — Update import to use new sync function
- `server/package.json` — Already has `sports-odds-api` v1.3.0; may remove `odds-api-io`
- `client/src/lib/types.ts` — `OddsRow` type (no changes needed)

## Verification
1. TypeScript compilation: `cd server && npx tsc --noEmit` — should have no errors
2. Manual test: hit `/api/cron/sync-odds` with the CRON_SECRET header and verify games + odds upserted
3. Check `/api/games` returns games with populated odds
4. Monitor API call count — should be 1 paginated call (not N+1)

## Decisions
- **sportID**: `BASKETBALL` (user-specified)
- **leagueID**: `NCAAB` (user-specified)
- **Primary bookmaker**: DraftKings (`draftkings`)
- **Odds format**: American (SDK returns American odds as strings in `bookOdds` / `byBookmaker.*.odds`)
- **API efficiency**: Single events.get() call with embedded odds — no separate odds calls
- **Env var**: `SPORTS_ODDS_API_KEY_HEADER` (matches SDK default / existing code)

## Further Considerations
1. **Should we remove `syncOdds.ts` entirely or keep it as fallback?** Recommendation: remove it and the `odds-api-io` dependency to avoid confusion.
2. **Should the function remain named `syncOdds2` or be renamed to `syncOdds`?** Recommendation: rename to `syncOdds` for clean imports.
3. **Consensus odds vs DraftKings-specific**: The SDK provides both `bookOdds` (consensus) and `byBookmaker.draftkings.odds` (DraftKings-specific). Currently the old code used DraftKings. Recommendation: continue with DraftKings via `byBookmaker.draftkings` but fall back to `bookOdds` if DraftKings unavailable.