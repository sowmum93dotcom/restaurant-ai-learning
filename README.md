# Verra — AI Local Search Engine (Learning Project)

**Verra** is an AI local search engine covering two categories —
**restaurants** and **retail shops** — where a customer describes what
they want and gets back ranked, location-aware, verified results. Business
owners can claim and manage their own listings, and admins can review and
verify them.

This is the **real backend version**: a Next.js app with real API routes
and a real database (SQLite for local development), replacing the earlier
static HTML/JS demo that stored everything in the browser's `localStorage`.

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
- A hosted production database (this runs on local SQLite by default —
  see "Moving to a real hosted database" below)

These are the next phases in the [Architecture Plan](#) doc this project
was built from — this version completes the "real backend + database"
phase.

## Technology

- **Next.js** (React + TypeScript, App Router) — one app for both the
  pages and the API routes.
- **Prisma** — type-safe database access and schema management.
- **SQLite** — a real database that's a single file on disk, needs zero
  setup. Swapping to a hosted Postgres database later is a small config
  change (same Prisma schema).
- Plain CSS (`app/globals.css`) — no CSS framework, kept simple.
- Custom cookie-based sessions with hashed passwords (`bcryptjs`) — no
  external auth provider needed for this phase.

## File structure

```
verra/
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
│   ├── search.ts               # Query parsing + ranking logic
│   ├── neighborhoods.ts        # Sample neighborhood data
│   └── seedData.ts             # Sample listings (used by seed + reset)
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Populates the database with sample data
└── README.md
```

## How to run it

This now requires Node.js (unlike the earlier plain-HTML version).

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your local environment file:
   ```bash
   cp .env.example .env
   ```
3. Create the database and fill it with sample data:
   ```bash
   npm run db:push
   npm run db:seed
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` in your browser.

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

## Moving to a real hosted database

The local SQLite file (`prisma/dev.db`) is great for development but
isn't shared between devices or deployed servers. To move to a real
hosted Postgres database later (e.g. Supabase or Neon):

1. Change `provider = "sqlite"` to `provider = "postgresql"` in
   `prisma/schema.prisma`.
2. Set `DATABASE_URL` in `.env` to your Postgres connection string.
3. Run `npm run db:push` (or set up proper migrations with
   `npx prisma migrate dev`) against the new database.

No application code needs to change for this move — it was designed that
way from the start.

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
  OpenStreetMap and geocoded to real latitude/longitude (PostGIS).
- Move from local SQLite to a hosted Postgres database (see above) and
  deploy the app (e.g. to Vercel).
- Connect the homepage's "Generate Marketing Campaign" button to a real
  AI service.
