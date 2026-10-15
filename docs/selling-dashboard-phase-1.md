# Selling Vendor dashboard — Phase 1

The clean dashboard lives at `/selling-vendor`. It uses `selling-dashboard.html`,
`js/selling-dashboard.js` and `css/selling-dashboard.css`. Every section uses that
same entry point. The retired dashboard, manage pages, inspection APIs and
development workspaces remain deleted.

## Identity and data contract

The browser loads the existing public Clerk configuration and restores the existing
Clerk session. Each context request sends the current session token, retries one
401 with a fresh token, and clears private content before revalidation. Sign-out,
account changes, page restoration, navigation and visibility restoration invalidate
the previous context. Responses from an older request cannot restore it.

`GET /api/businesses?resource=selling-dashboard[&businessId=…]` uses the existing
businesses function, authentication resolver, SQL business ownership relationships,
actor authorization and the applicable server authority. Real businesses retain the
server-maintained `applicationAccess.selling` grant. A
model selection, test identity, administrator role or URL is never an access grant.
Selected business ownership and server authorization are checked again before response.
Multiple businesses require selection; no arbitrary first business is chosen.

Contract version 1 returns `vendor.identityId`, authorized business summaries,
the selected `business` (or null) and `phase: 1`. Both live and test summaries use
`businessId`, `name`, `type`, `location` and `dataEnvironment`. The endpoint never
returns products, campaign details, stock or private orders. No existing data is
rewritten and no database schema migration is added.

## Test businesses

Test businesses use the same persisted ownership, dashboard and context API. They
have a separate **server-controlled Preview authorization**, independent of real
Selling application approval. They must use the existing reserved `test-business-`
namespace, which the existing customer-publication rules exclude from genuine
customer work. All `test-` identities for business records are denied in Production.
Test accounts never bypass Clerk verification, ownership or explicit server authorization.

Before authorizing a live Preview test journey, bind this branch's existing
Postgres adapter to an **isolated Preview database/branch using the same shared
schema**. Do not seed or write test records through a Preview that points at live
data. Then configure, scoped only to the Preview branch:

- `DEMEOS_SELLING_DATA_ENVIRONMENT=test`
- `DEMEOS_SELLING_TEST_PREVIEW_BRANCH` equal to the exact Preview Git branch.
- `DEMEOS_SELLING_TEST_DATABASE_HOST` equal to the isolated pooled database host.
- `DEMEOS_SELLING_TEST_AUTHORIZATIONS` as a JSON array of exact
  `{ "businessId": "test-business-…", "ownerIdentityId": "<verified Clerk user ID>" }`
  pairs. The identity must independently own the business in SQL.

The handler checks the actual `POSTGRES_URL` used by the existing pool adapter
against the pinned host before opening test records. Wrong-host or wrong-branch
configuration fails closed before repository access. Browser query parameters,
roles, profile approval flags and the retired business-ID-only allowlist cannot
provide a test grant. Removing the server authorization revokes test access;
changing real-business Selling approval does not control this independent path.

The test environment hides real businesses. Missing or malformed test configuration
denies test businesses. Production ignores test authorization even if those
variables are accidentally copied there. Normal live businesses require the same
Selling grant and ownership with no test configuration.

For PR #708, Neon branch `br-flat-snow-zatzl87u` (`demeos-pr708-selling-preview`)
is a dedicated child of the existing schema-only Preview branch, not Production.
Its endpoint differs from Production. Before seeding, SQL verification found one
inherited isolated test business, zero campaigns, zero orders and zero application
reviews. The existing shared schema was retained. All Postgres environment bindings
were overridden only for `rebuild/selling-foundation-phase-1` in Preview.

The new `test-business-selling-708` record has a persisted owner relationship
derived from the existing isolated test owner. It deliberately has no
`applicationAccess` grant and no products. Its exact business/owner pair is held
in server-only environment configuration, never shipped in client code.

Sign-in initiated from the dashboard and its OAuth callback force the successful
destination to `/selling-vendor`, overriding legacy application redirects. Direct
navigation and refresh stay on the same dashboard. Marketing and real-business
registration/approval code remain unchanged.

## Verification

- `npm test`: complete Node suite, including Marketing and shared API regressions.
- `node --test test/selling-dashboard.test.js test/dashboard-retirement.test.js`:
  actual PGlite ownership, live/test contracts, revocation, cross-owner rejection,
  request spoofing, method handling, empty states and failure responses.
- `node browser-checks/selling-dashboard-gate.js`: real shipped HTML/JS/CSS and
  context handler with isolated PGlite SQL. The identity provider is adapted only
  inside the browser harness, following the existing repository gates. Covers
  seven-section navigation, direct entry, refresh, desktop/mobile overflow,
  business switching, account switching, sign-out, test access, revocation and
  loading/empty/error/denied states. Runs in the existing GitHub browser workflow;
  screenshots are included in its review artifact.

The local sandbox cannot launch Chromium (SIGTRAP). Rendered verification therefore
runs in GitHub Actions. A successful isolated SQL/browser gate is not a claim that
a live Clerk test account and isolated Vercel database have been provisioned.

## Phase 2 boundary

The shell and private business context are the foundation for catalogue work.
All remaining sections explain their unavailable tools. There are no fake upload,
stock or order actions, invented counts, separate test pages or product mocks.
Do not start catalogue work until Phase 1 verification, including the deployed
authorized vendor journey and Preview data isolation, is complete. Phase 2 must
reuse the existing business/product APIs and contracts and enforce the same data
environment policy at every product/media/stock/order boundary before test writes.
