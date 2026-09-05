# DEMEOS Marketing Agent

A lightweight restaurant marketing application with Business Manager Profiles,
AI-assisted campaign generation, revisions, version-specific approval, and
business-scoped campaign history.

## Technology

The client uses plain HTML, CSS, and JavaScript. Vercel serverless functions
provide AI generation and a minimal PostgreSQL persistence API. Business
profiles and campaigns remain in `localStorage` as a compatibility and offline
fallback; on startup, existing local records are idempotently copied to the
server without replacing their IDs or campaign continuity metadata.

## Database configuration

Attach a PostgreSQL integration to the Vercel project and provide either
`POSTGRES_URL` or `DATABASE_URL`. Tables and indexes are created automatically
on the first persistence request. The persistence API is intentionally small:

- `GET`, `POST`, or `PUT /api/businesses`
- `GET` or `POST /api/campaigns`
- `PATCH /api/campaigns` for a business-scoped approval update

Authentication is deliberately not part of this foundation. The database
module and business-scoped campaign queries provide a server-side boundary
where tenant authorization can be added later.

## Local development

Install dependencies and run the tests:

```bash
npm install
npm test
```

To view the static interface, run:

```bash
python3 -m http.server 8000
```

Campaign generation requires `OPENAI_API_KEY`. Durable persistence requires a
PostgreSQL connection string; without one, the browser workflow continues using
its existing local data.
