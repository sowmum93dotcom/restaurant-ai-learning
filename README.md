# Verra — AI Local Search Engine (Learning Project)

**Verra** is an AI local search engine covering two categories —
**restaurants** and **retail shops** — where a customer describes what
they want and gets back ranked, location-aware, verified results. Business
owners can claim and manage their own listings, and admins can review and
verify them.

This is the **real system**, not a demo: a Next.js app with its own API
routes and a real PostgreSQL database, replacing the earlier static
HTML/JS version that stored everything in the browser's `localStorage`.

**Current status: built, not yet deployed.** The app runs against a real
Postgres database (locally during development; a hosted one in
production), and calls the real Claude API for search when configured —
but it isn't live anywhere yet. See "Deploying" below for exactly what's
needed to put it on the internet.

## What's included

- **Homepage** (`/`) — a sample restaurant page with an "AI Marketing
  Assistant" that generates sample marketing copy (still a local
  placeholder, not a real AI call — see "What's NOT included yet" below).
- **Search** (`/search`) — type what you want, get ranked results across
  restaurants and retail shops, with a plain-English explanation of why
  each one matched. Query understanding uses a real Claude API call when
  `ANTHROPIC_API_KEY` is set (see `lib/aiSearch.ts`), and falls back to
  keyword matching otherwise — the results page shows which one ran.
- **Owner Panel** (`/owner`) — sign up / sign in, then claim an existing
  business listing or add a new one.
- **Admin Panel** (`/admin`) — sign in as an admin to review every
  listing, verify/unverify, delete bad entries, and reset demo data.

## What's NOT included yet (on purpose)

- Payments
- An API key in this sandbox — real AI query understanding is wired up
  (`lib/aiSearch.ts`) but needs you to set `ANTHROPIC_API_KEY`; without it,
  search runs on the keyword-matching fallback in `lib/search.ts`
- Real identity verification (an owner "claiming" a listing is still a
  self-attestation checkbox, not a confirmed email/phone/document check)
- Real location data (listings use the same simulated map coordinates as
  the earlier demo, not real addresses pulled from OpenStreetMap)
- **Hosting** — nothing is deployed publicly yet; the app only runs
  wherever you start it (see "Deploying" below)

These are the next phases in the [Architecture Plan](#) doc this project
was built from — this version completes the "real backend + database"
phase.

## Technology

- **Next.js** (React + TypeScript, App Router) — one app for both the
  pages and the API routes.
- **Prisma** — type-safe database access and schema management.
- **PostgreSQL** — a local instance for development, a hosted one (e.g.
  Supabase) in production. Same schema, same code, either way.
- Plain CSS (`app/globals.css`) — no CSS framework, kept simple.
- Custom cookie-based sessions with hashed passwords (`bcryptjs`) — no
  external auth provider needed for this phase.

## File structure

```
verra/
├── .github/workflows/ci.yml    # Runs a real Postgres + build on every push
├── app/
│   ├── layout.tsx              # Root HTML layout
│   ├── globals.css             # All styling
│   ├── page.tsx                # Homepage
│   ├── search/page.tsx         # Search page
│   ├── owner/page.tsx          # Owner panel (signup/login + claim/add)
│   ├── admin/page.tsx          # Admin panel (review/verify/delete)
│   ├── components/
│   │   └── MarketingAssistant.tsx
│   └── api/                    # Backend API routes
│       ├── search/route.ts
│       ├── listings/[id]/route.ts
│       ├── auth/{signup,login,logout,me}/route.ts
│       ├── owner/listings/{route.ts,[id]/claim/route.ts}
│       └── admin/{listings,reset}/...
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── auth.ts                 # Password hashing + session cookies
│   ├── search.ts                # Query parsing + ranking logic
│   ├── aiSearch.ts              # Real Claude API query understanding
│   ├── listingValidation.ts    # Shared input validation (owner writes)
│   ├── neighborhoods.ts        # Sample neighborhood data
│   └── seedData.ts             # Sample listings (used by seed + reset)
├── prisma/
│   ├── schema.prisma           # Database schema (with indexes)
│   └── seed.ts                 # Populates the database with sample data
└── README.md
```

## How to run it locally

This requires Node.js and a PostgreSQL server (unlike the earlier
plain-HTML version, and unlike the brief SQLite phase this project passed
through — it's Postgres now, matching production).

1. Install dependencies:
   ```bash
   npm install
   ```
2. Have a Postgres server running and create a database for this project
   (e.g. `createdb verra`, or use Postgres.app / Docker / your OS's
   package manager if you don't have one yet).
3. Set up your local environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `DATABASE_URL` in `.env` to match your local Postgres
   (user/password/host/port/database name).
4. Create the schema and fill it with sample data:
   ```bash
   npm run db:push
   npm run db:seed
   ```
5. Start the app:
   ```bash
   npm run dev
   ```
6. Open `http://localhost:3000` in your browser.

**Seeded admin login:** `admin@verra.app` / `admin123` (change this before
deploying anywhere real — it's only for local development).

Owner accounts aren't seeded — use the "Create an account" link on the
Owner Panel to sign up with any email/password.

### Resetting the database

If you want to start over with fresh sample data:

```bash
npm run db:seed
```

(or use the "Reset to sample data" button in the Admin Panel, which does
the same thing without clearing user accounts).

## Deploying (making it actually live)

Nothing here happens automatically — each step below is something you do
once, using your own accounts. None of it requires a code change beyond
what's already in this repo.

### 1. Create a hosted database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (free tier
   is enough to start).
2. In the project, go to **Project Settings → Database → Connection
   string → URI**. Copy the one labeled **Transaction pooler** (port
   `6543`) — that's the one that works with serverless hosting like
   Vercel; the direct connection (port `5432`) will time out there.
3. You'll paste this in as `DATABASE_URL` in the next step.

### 2. Deploy the app (Vercel)

1. Push this repo to GitHub (already done if you're reading this from
   the repo).
2. Go to [vercel.com](https://vercel.com), **Add New → Project**, and
   import this GitHub repo. Vercel auto-detects Next.js — no config
   needed.
3. Before the first deploy, add these **Environment Variables** in
   Vercel's project settings:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | The Supabase connection string from step 1 |
   | `ANTHROPIC_API_KEY` | Your key from [console.anthropic.com](https://console.anthropic.com/) (optional — omit to use the keyword fallback) |
4. Deploy. Vercel builds and gives you a live URL.

### 3. Create the schema and seed data on the live database

Prisma needs to run once against the live database to create its tables.
From your own machine (with `DATABASE_URL` in `.env` pointed at the same
Supabase connection string):
```bash
npm run db:push
npm run db:seed
```
After this, the live site at your Vercel URL should show the same 11
sample listings as local development, and the seeded admin login
(`admin@verra.app` / `admin123` — **change this password** before
sharing the URL with anyone).

## Enabling real AI query understanding

Set `ANTHROPIC_API_KEY` in `.env` (get a key at
[console.anthropic.com](https://console.anthropic.com/)) and restart the
dev server. Search will then call Claude (`claude-opus-5-5`) to extract
filters from the query instead of keyword matching — no other config
needed. If the call fails for any reason (bad key, network issue,
rate limit), search automatically falls back to keyword matching rather
than breaking; the results page always shows which one actually ran.

## Next steps (future phases)

- Replace the self-attestation checkbox with real identity verification
  (confirmation email, phone code, or document upload).
- Replace the simulated map coordinates with real addresses, pulled from
  OpenStreetMap and geocoded to real latitude/longitude (PostGIS, which
  Supabase supports as an extension).
- Actually deploy it (see "Deploying" above) — the code is ready, this
  just needs your Supabase/Vercel accounts and credentials.
- Connect the homepage's "Generate Marketing Campaign" button to a real
  AI service.
