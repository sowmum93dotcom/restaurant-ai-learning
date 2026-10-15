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

## Existing DEMEOS system connections

Inspection covers the existing route handlers, persistence repository, SQL schema,
authentication/authorization modules and customer publication rules. The table
separates the working Phase 1 connection from the existing components reserved for
later tool integration. It does not mark those tools as implemented.

| Dashboard section | Existing DEMEOS components and authoritative records | Phase 1 connection and remaining boundary |
| --- | --- | --- |
| Overview | `api/businesses.js?resource=selling-dashboard` dispatches to `api/_lib/selling-dashboard.js`; `demeos-authentication.js` verifies Clerk; `getOwnedBusinessProfiles`, `isBusinessOwnedByIdentity` and `getKnownBusiness` in `api/_lib/persistence.js` resolve `demeos_business_owners` and `demeos_businesses.profile`. `demeos-actor-context.js` / `demeos-authorization.js` retain actor permissions. | Connected now: authenticated vendor, exact authorized business selection and live/test environment badge. No invented product, stock, revenue or order counts. Future summaries must derive from the same business-scoped sources below. |
| My Business | The same `demeos_businesses.profile` and SQL owner relationship; existing owner registration uses `createBusinessForOwner`, with `api/businesses/[businessId].js` validating profile facts and `saveOwnedBusinessProfile` preserving ownership checks. `js/business-onboarding.js`, `business-application-contract.js`, `business-application-review.js`, `recordBusinessApplicationAccess` and `demeos_business_application_reviews` maintain submission, revision audit and application decisions. `business-application-access.js` and `business-workspace-readiness.js` expose real Selling/Marketing grants. `api/businesses/bootstrap-owner.js` remains its existing narrowly configured owner bootstrap, not a general test-registration path. | Connected now: read-only name, ID, type, location and authorized dashboard status from the existing record. Registration, editing, submission and real-business approval remain in their existing workflow. No replacement registration form or business model. |
| Product Catalogue | `GET/PUT /api/businesses/:businessId/products` (`api/businesses/[businessId]/products.js`); products live in the existing business profile's `products` array, identified by `businessId` and `productId`. The handler reuses `validateProfile` from `[businessId].js`, `preserveProduct` from `js/business-product-preparation.js`, `catalogueRevision` from `vendor-inventory.js` and `saveSellingProducts` from the shared repository. Saves verify ownership, accuracy confirmation, profile version and optimistic catalogue revision. | Tool not connected yet. Reuse these contracts and this array; no second product table/catalogue. The current test business has no products and is not represented as catalogue-ready. |
| Images & Videos | `GET/POST /api/businesses/:businessId/media` and `PATCH /api/businesses/:businessId/media/:assetId`; `demeos_business_media_assets` and `demeos_media_processing_jobs`; `media-asset-contract.js`, `media-upload-session.js`, `media-upload-completion.js`, `media-storage-driver.js` and the existing processing modules. Product media uses `asset.businessId`, `purpose` and `relatedEntityId === productId`; product galleries store exact `assetIds` and `mainAssetId`. Ready-state and same-business/product references are checked by the existing handlers. The configured adapter supports private Vercel Blob or HTTP object storage. | Upload/library tools not connected yet. Reuse the existing private storage lifecycle and product links; no replacement bucket, sample-media API or browser-claimed ready state. Private upload/processing/delivery credentials must stay server-side. |
| Options & Variants | Existing `product.presentation.options` and `.variants` in the same profile products, including exact `variantId`, option selection, availability and pricing. `js/customer-item-contract.js`, `js/business-product-preparation.js`, the products handler and `api/_lib/vendor-inventory.js` validate/preserve these contracts. `stockIdentity` binds a recorded stock row to the exact product/variant selection. | Editor not connected yet. Save through the same product API. Do not infer combinations, introduce a parallel variant store or reassign recorded stock to a different option combination. |
| Stock & History | `GET/PUT /api/businesses/:businessId/inventory`; `api/_lib/vendor-inventory.js` (`rowsFor`, `applyChanges`, `stockIdentity`, `catalogueRevision`); `getVendorInventory` / `saveVendorInventory`; existing `demeos_vendor_inventory` and `demeos_vendor_stock_history`. Rows are keyed by the exact product/variant pair. Revisions, reserved quantities, SKU rules, reasons, ownership and atomic audit writes are already protected. | Stock tools not connected yet. Reuse the existing ledger and history; no placeholder balances, separate test inventory or claimed stock-saving action. |
| Private Orders | `GET /api/businesses/:businessId/orders` delegates to `getVendorOrders` / `vendorOrders.listOwned`; `api/_lib/vendor-orders.js` owns reservation, cancellation, expiry, idempotency, frozen line prices and stock reservation transactions. Existing tables are `demeos_vendor_orders`, `demeos_vendor_order_requests` and `demeos_vendor_order_events`, alongside the shared inventory/history tables. `api/_lib/customer-checkout.js` retains its independent customer/merchant/purchase authorization boundary. | Order tools not connected yet. The existing list API reports `liveOrderingActive: false`, and current readiness keeps `canSell: false`. No live purchase capability, mock orders or new order system is activated by dashboard access. |

### Customer visibility is a separate permission boundary

`api/_lib/customer-publication-rules.js` checks approved eligible campaign content,
matching source identities and business-information provenance. It excludes the
reserved `test-business-…` / controlled-content namespace even if a stored campaign
claims approval. `api/_lib/customer-catalogue.js`, the public projection in
`api/_lib/persistence.js`, `js/customer-item-contract.js` and
`api/_lib/customer-checkout.js` retain their existing product visibility and
purchase-readiness checks. Private owner records, draft preparation, private media
paths and a dashboard authorization never constitute customer publication or
merchant/purchase permission.

### One dashboard and one set of future tools

There is one HTML entry, one controller, one context contract and seven sections.
Real businesses use their own SQL-owned records and real Selling approval. The
explicit server-controlled test-owner/business grant works only on the configured
isolated Preview branch/database and never in Production. Test records use the
same business, product, media, stock and order contracts; identity, authority and
data environment differ, not the dashboard or eventual tool implementation.

The existing product, media, inventory and order APIs are **not wired into this
dashboard yet**. Several route and SQL write guards still require real Selling
approval (`authorizeBusinessOwnerRequest`, `canManage`, `saveSellingProducts`,
`saveVendorInventory`, and order transactions). A later tool-integration phase must
apply the agreed authorization consistently through those existing routes and
transaction guards, preserving real-business approval while enforcing exact test
ownership and isolated data. Do not silently set a test profile's real approval
flag, weaken Production rules, add test-only tools or imply that the current shell
already provides those operations. No such API/write changes are part of this fix.

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
runs in GitHub Actions. The Selling browser gate checks iPhone-sized widths 375,
390 and 430, plus desktop width 1440. It measures the business identity column,
name height, stacked badge/selector and page overflow for live and test contexts;
screenshots capture both. The mobile fix appends the specified single-column grid
override without changing the desktop layout.

The isolated Preview database/test record is configured as described above. A
passing isolated SQL/browser gate verifies the shipped UI and access rules with
an identity-provider adapter; it does not independently establish a fresh live
Clerk sign-in on Vercel. The user reported that the authorized test vendor can
open the current dashboard. Independent live-browser confirmation must still be
recorded before merge; do not replace it with the automated adapter result.

## Phase 2 boundary

The shell and private business context are the foundation for catalogue work.
All remaining sections explain their unavailable tools. There are no fake upload,
stock or order actions, invented counts, separate test pages or product mocks.
Do not start catalogue work until Phase 1 verification, including the deployed
authorized vendor journey and Preview data isolation, is complete. Phase 2 must
reuse the existing business/product APIs and contracts and enforce the same data
environment policy at every product/media/stock/order boundary before test writes.
