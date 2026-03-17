Plan: Migrate Next.js → Fastify + Vite SPA
Replace the Next.js app with a Fastify API server (backend) and a Vite + React Router SPA (frontend). Business logic ports directly. Server-rendered pages become API endpoints consumed by the SPA. Auth moves from Next.js cookie middleware to JWT-based Fastify hooks.

Phase 1: Scaffold Fastify Server
Create server with package.json (fastify, @fastify/cookie, @fastify/cors, @fastify/static, @supabase/supabase-js, tsx)
Create entry point index.ts — registers plugins and route modules
Copy types.ts and odds.ts as-is (zero Next.js dependencies)
Create server/src/lib/supabase.ts — createServiceClient(), createAnonClient(), createUserClient(token)
Create server/src/plugins/auth.ts — requireAuth preHandler that extracts JWT from Authorization header, verifies via supabase.auth.getUser(), attaches user to request
Phase 2: Port API Routes
Adapt syncOdds.ts — swap Supabase client import, logic identical
Port POST /api/bets — replace NextRequest/NextResponse with Fastify request/reply; business logic unchanged
Port GET /api/cron/sync-odds and GET /api/cron/sync-scores — trivial port, same CRON_SECRET auth
New GET /api/games — extracts query from dashboard/page.tsx (games + odds + user bet keys)
New GET /api/leaderboard — extracts query from leaderboard/page.tsx
New GET /api/profile — extracts query from dashboard/layout.tsx
Phase 3: Scaffold Vite React SPA
Create client/ with Vite + React + React Router + Tailwind + @supabase/supabase-js
vite.config.ts with dev proxy /api → localhost:3000
SPA shell: index.html, main.tsx (BrowserRouter), App.tsx (routes)
Copy globals.css styles
Phase 4: Migrate Frontend Components
NavBar.tsx — swap next/link → react-router-dom Link, usePathname → useLocation
GameCard.tsx — copy as-is (framework-agnostic)
BetModal.tsx — remove router.refresh(), add onBetPlaced callback, add Authorization header
Login.tsx / Signup.tsx — swap useRouter → useNavigate, Link from react-router-dom
Dashboard.tsx — rewrite from SSR to fetch('/api/games') on mount
Leaderboard.tsx — rewrite from SSR to fetch('/api/leaderboard') on mount
Phase 5: Static Serving & SPA Fallback
Fastify serves client/dist/ via @fastify/static
Catch-all returns index.html for non-API routes
Dev mode: Vite on :5173, Fastify on :3000, Vite proxies API calls
Phase 6: Cleanup
Delete app directory
Update README, create .env.example with renamed env vars
Environment Variables
Old	Server	Client (Vite)
NEXT_PUBLIC_SUPABASE_URL	SUPABASE_URL	VITE_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY	SUPABASE_ANON_KEY	VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY	same	—
ODDS_API_KEY	same	—
CRON_SECRET	same	—
Verification
Server starts on :3000, client on :5173
Auth flow: signup → profile created → dashboard redirect
Dashboard loads games via API, betting works via POST /api/bets
Leaderboard and profile fetch correctly
Cron endpoints respond to CRON_SECRET bearer auth
Production: client build → Fastify serves SPA with correct routing
Decisions
Two packages (server + client), no monorepo tooling
React Router for SPA routing
Auth via Authorization header (SPA sends Supabase session token)
No SSR — pure SPA (fine for a dashboard app)
DB schema unchanged — no migrations needed
Claude Opus 4.6 • 0x