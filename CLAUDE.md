# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

March Gamblor is an NCAA March Madness sports betting pool dashboard. Users place bets on games, view live scores/odds, and compete on a leaderboard. It was recently migrated from Next.js to a Fastify + React SPA architecture and deploys on Railway via Docker.

## Commands

### Install dependencies
```bash
npm run install:all        # Install both client and server deps
npm install --prefix client
npm install --prefix server
```

### Development
```bash
# Run server (from repo root or server/)
cd server && npm run dev   # tsx watch with .env, port 3000

# Run client (from repo root or client/)
cd client && npm run dev   # Vite dev server, port 5173
```
The client proxies `/api` → `http://localhost:3000` in dev mode.

### Build & Production
```bash
npm run build              # Build both client and server
npm start                  # Run production server (node server/dist/index.js)
```

### Supabase type generation
```bash
cd server && npm run gen-types   # Regenerate types from remote Supabase schema → src/lib/types.ts
```

## Architecture

**Client** (`client/src/`): React 19 SPA with Vite, Tailwind CSS v4 (PostCSS plugin), React Router v7. Path alias `@/*` → `src/*`.

**Server** (`server/src/`): Fastify v5 API. In production, serves the built client SPA as static files with a fallback route. Auth is validated via Supabase JWT in `plugins/auth.ts` (`requireAuth` decorator).

**Database**: Supabase (PostgreSQL). Generated types live in `server/src/lib/types.ts`. Three Supabase client factories in `server/src/lib/supabase.ts`:
- Service role client (admin ops)
- Anon client
- User-scoped client (passes user JWT for RLS)

**Data sync**: Two cron endpoints (`/api/cron/sync-odds`, `/api/cron/sync-scores`) are hit by an external scheduler (cron-job.org) every 5 minutes. They require a `CRON_SECRET` header. Odds come from the SportsGameOdds API (`sports-odds-api` SDK, DraftKings book); scores come from the public NCAA API (`ncaa-api.henrygd.me`).

**Deployment**: Railway via Dockerfile (multi-stage). Health check at `/api/health`.

## Environment Variables

Server requires a `.env` file with:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `SPORTS_ODDS_API_KEY_HEADER`
- `CRON_SECRET`

## Known Issues / In-Progress Work

- `server/src/lib/syncOdds2.ts` uses the new `sports-odds-api` SDK but has wrong API method calls — it is dead code. The active sync uses the old `syncOdds.ts` approach. See `sportsgameodds.md` for migration notes.
- `.vscode/launch.json` contains stale Next.js debug configs alongside the working "Debug Server" config.
