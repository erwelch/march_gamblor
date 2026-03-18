Plan: Deploy March Gamblor on Railway
Given your constraints (< $10/mo, downtime OK, 5-min cron), Railway is the best fit — $5/mo Hobby plan, built-in cron, zero Docker/ops overhead.

Steps

Phase 1 — Code Changes
Remove sync-on-page-load from games.ts

Delete the import { syncOdds2 as syncOdds } on line 3
Delete the fire-and-forget syncOdds() block on lines 11–13
Odds will now only sync via the cron endpoints, not on every GET /api/games request
Add a health check endpoint in index.ts — add GET /api/health returning { status: 'ok' } before the static file serving. Railway uses this to know your app is alive.

Phase 2 — Railway Setup
Create a Railway account at railway.app and start a new project from your GitHub repo
Configure build & start commands in Railway dashboard:
Build: cd client && npm install && npm run build && cd ../server && npm install && npm run build
Start: cd server && node --env-file=.env dist/index.js
Root directory: / (repo root)
Set environment variables in Railway dashboard:
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (needed at client build time)
SPORTS_ODDS_API_KEY_HEADER
CRON_SECRET (generate a random string)
NODE_ENV=production
PORT=3000
Set health check in Railway service settings: path /api/health
Phase 3 — Cron Scheduling (5 min)
Set up cron jobs — two options:
Option A (recommended): cron-job.org — free tier, create two jobs with schedule */5 * * * *:
GET https://<your-railway-domain>/api/cron/sync-odds with header Authorization: Bearer <CRON_SECRET>
GET https://<your-railway-domain>/api/cron/sync-scores with header Authorization: Bearer <CRON_SECRET>
Option B: Railway cron service — add a second Railway service that runs a curl command on a cron schedule (slightly more complex, costs extra)
Relevant files

games.ts — remove syncOdds() import (line 3) and call (lines 11–13)
index.ts — add GET /api/health endpoint before static file registration (~line 23)
cron.ts — no changes needed, already has the endpoints
Verification

After removing sync from games.ts: run cd server && npx tsc --noEmit to confirm no compile errors
After deploying: hit https://<domain>/api/health — should return { status: 'ok' }
Manually trigger GET /api/cron/sync-odds with the bearer token to confirm odds sync works
Verify cron-job.org logs show successful 200 responses every 5 minutes
Load the app in browser, confirm games display (from cached DB data)
Decisions

Railway Hobby plan ($5/mo) — fits budget, downtime on deploys is acceptable per your requirements
cron-job.org free tier for scheduling — avoids paying for a second Railway service
No Dockerfile needed — Railway auto-detects Node.js and runs build/start commands directly
Both odds and scores sync every 5 minutes — scores sync is cheap (public NCAA API, no rate limits)
Further Considerations

SportsGameOdds API rate limits — at every-5-min sync, that's 288 calls/day. Confirm your API plan supports this. If limited, you could reduce to every 10 or 15 minutes.
Custom domain — Railway provides a free *.up.railway.app domain. You can add a custom domain at no extra cost if desired.