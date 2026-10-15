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
actor authorization and server-maintained `applicationAccess.selling` grant. A
model selection, test identity, administrator role or URL is never an access grant.
Selected business ownership and Selling approval are checked again before response.
Multiple businesses require selection; no arbitrary first business is chosen.

Contract version 1 returns `vendor.identityId`, authorized business summaries,
the selected `business` (or null) and `phase: 1`. Both live and test summaries use
`businessId`, `name`, `type`, `location` and `dataEnvironment`. The endpoint never
returns products, campaign details, stock or private orders. No existing data is
rewritten and no database schema migration is added.

## Test businesses

Test businesses use the same persisted ownership, administrative Selling approval,
dashboard and context API. They must use the existing reserved `test-business-`
namespace, which the existing customer-publication rules exclude from genuine
customer work. All `test-` identities for business records are denied in Production.
Test accounts themselves do not bypass ownership or approval.

Before authorizing a live Preview test journey, bind this branch's existing
Postgres adapter to an **isolated Preview database/branch using the same shared
schema**. Do not seed or write test records through a Preview that points at live
data. Then configure, scoped only to the Preview branch:

- `DEMEOS_SELLING_DATA_ENVIRONMENT=test`
- `DEMEOS_SELLING_TEST_BUSINESS_IDS` as a JSON array of exact authorized
  `test-business-…` IDs.

The test environment hides real businesses. Missing or malformed test configuration
denies test businesses. Production ignores test authorization even if those
variables are accidentally copied there. Normal live businesses require the same
Selling grant and ownership with no test configuration.

The environment setting labels a deliberately isolated binding; it does not create
or prove database isolation. Never use it as a replacement for configuring the
Preview database. At initial inspection the new branch had no isolated database
override or authorized test-business configuration. No remote data was seeded.

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
