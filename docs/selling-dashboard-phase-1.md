# DEMEOS Selling Vendor dashboard

The existing `/selling-vendor` entry, `selling-dashboard.html`, controller and
navy/blue/gold design serve all seven sections. There is no second dashboard,
test page, registration system or business database. Historical Phase 1 shell
notes are superseded by the working-tool implementation below. CI results and
the exact deployed revision are recorded in PR #708; code being present does
not establish deployed Clerk acceptance.

## Identity, permissions and isolation

Existing Clerk verification supplies the trusted identity. SQL ownership remains
authoritative. Every request resolves the selected business, rechecks persisted
ownership and checks the server's applicable Selling authority. Reads use the
existing owner-view action; writes use the profile/media management action.
Responses are private and not cached. Account/business changes clear private
forms, and navigation revalidates access.

Real businesses require their existing `applicationAccess.selling` grant.
`api/_lib/selling-access.js` holds the same exact Preview test-owner/business
policy used by the context handler and SQL write boundaries. Test grants require:

- `VERCEL_ENV=preview` and `DEMEOS_SELLING_DATA_ENVIRONMENT=test`.
- The exact configured Preview Git branch and pinned actual Postgres hostname.
- An exact server-configured business/Clerk-owner pair and persisted ownership.
- A reserved `test-business-` identity. Production rejects test identities.

Browser parameters, roles and client flags never grant access. The configured
PR #708 Neon branch remains `br-flat-snow-zatzl87u`, a child of the existing
schema-only Preview branch. Its bindings apply only to
`rebuild/selling-foundation-phase-1` in Preview. No destructive migration or
Production database/environment change is part of this implementation.

## Existing systems used by the seven tools

| Section | Real behavior and existing DEMEOS source | Boundary |
| --- | --- | --- |
| Overview | Counts saved products, available products, simple/structured variants, tracked inventory rows and the latest private orders from the selected business context. | Counts reflect actual loaded records; recent orders are bounded to 50. No invented revenue or sales analytics. |
| My Business | Displays saved identity/contact information and permits name, location and description edits. Existing profile validation, explicit owner accuracy confirmation, SQL ownership and profile-revision checks protect saves. Existing information-review state returns to draft where applicable. | Ownership, Selling/Marketing grants, type, registration and contact-route administration stay in the existing registration workflow. Ordinary edits cannot approve the business. |
| Product Catalogue | Create/edit/delete uses the existing `demeos_businesses.profile.products` array and `saveSellingProducts` repository. IDs remain stable on retries. Profile revisions and SQL compare-and-swap reject stale writes. | Edits preserve legacy publication flags until workflow enrollment, galleries, unknown extensions, variants and stock history. Managed submissions keep the working copy private. Structured price edits retain option/variant identities and override prices. Reserved items cannot be deleted. |
| Options & Variants | Named variants use the existing branch's product-linked `variants` records. Existing `presentation.variants` are also displayed and edited without changing their exact option selection. SKU, optional price, base-price inheritance and availability persist through the same catalogue writer. | Invalid IDs/prices, duplicate SKU conflicts and stale writes are rejected. Recorded stock identities cannot be reused for replacement variants; reserved variants cannot be deleted. |
| Stock & History | Uses existing `demeos_vendor_inventory` and `demeos_vendor_stock_history`, `vendor-inventory.js` row identities/validation and atomic `saveVendorInventory`. Product and exact variant rows have distinct balances. | Whole counts, reservations, catalogue/stock revisions and authenticated audit identity are protected. The view shows the latest 30 ledger events; older history stays in SQL. Earlier product-level audit records are retained, and an untracked legacy base count supplies its first ledger adjustment's starting balance. |
| Images & Videos | Uses existing media assets/jobs, upload sessions, exact product relationships, private Vercel Blob storage and processing lifecycle. A real Sharp driver decodes JPEG/PNG/WebP and writes verified WebP master/thumbnail/customer/marketing outputs. Ready media links into the product's existing gallery. Private previews are freshly signed. | Video requires an actual configured transcoder; Sharp does not supply one. Removal archives the asset and unlinks it; it does not claim physical Blob erasure. Product deletion atomically archives its related media. Customer publication is independent. |
| Private Orders | Reads the existing `demeos_vendor_orders` through the ownership-checked order repository. Order details show frozen product/variant, quantity, currency, amount, status and dates. Records survive product deletion. | The existing service supports reservation/customer cancellation/expiry, not vendor fulfillment transitions. Live purchasing/payment activation is unchanged and remains unavailable. Controlled test records cannot create real orders; an empty test-business order view is honest. |

## Media configuration

The PR branch's Preview uses the existing private Blob store with
`DEMEOS_MEDIA_STORAGE_PROVIDER=vercel-blob`, a branch-scoped
`DEMEOS_MEDIA_UPLOAD_SECRET` and `DEMEOS_MEDIA_PROCESSING_PROVIDER=sharp`.
No new storage provider or paid service is provisioned. Upload and processing
paths include the exact business and asset IDs. Credentials remain server-side.
The same code supports real and explicitly authorized test businesses.

Images are limited to 15 MB and 40 million decoded pixels. Claimed MIME type must
match real decoded JPEG/PNG/WebP bytes; animated images and unsafe formats are
rejected. Sharp strips metadata and bounds output dimensions. The existing worker
verifies every stored output before accepting ready state. A processing completion
cannot resurrect an archived asset. Upload metadata or a pasted URL is not a file.
Video remains disabled on this Preview because no video inspection/transcoding
service is configured. The UI states this explicitly.

## Contracts and correctness

`GET /api/businesses?resource=selling-dashboard&businessId=…` returns the current
private business, catalogue revision, media capabilities/assets, inventory, genuine
summary and recent orders. The selector contains only authorized business summaries.
POST actions use the same route and ownership boundary. Catalogue/profile/media
writes require the current catalogue revision; stock also requires its current
inventory revision. Real and test businesses use the same actions and contracts.

Writes disable conflicting controls. The client re-reads the authorized context
and verifies saved values before displaying success. Stable product, variant and
upload IDs protect ambiguous retries; stale snapshots produce actionable errors.
The original customer-publication, merchant and purchase authorization rules remain
separate. New products stay private; editing existing products does not silently
publish or unpublish them.

## Verification

- `npm test` covers the existing regressions plus actual SQL CRUD, ownership,
  revocation, isolated Preview grants, invalid data, conflicts, preserved fields,
  inventory history/reservations, media processing and genuine order reads.
- `test/selling-media.test.js` writes actual binary files through the private
  object-store boundary and runs the shipped decoder, optimizer, worker, gallery
  persistence, refresh and removal flow for real/Preview fixtures. Unsafe disguised
  bytes and metadata-only completion cannot become ready uploads.
- The shipped browser gate uses real HTML/JS/CSS, PGlite and binary file storage.
  The only external adapters are the identity provider, test server and private
  object-store boundary. No alternate test dashboard/API is shipped.
- Browser checks cover catalogue and variant CRUD, availability, uploads and image
  decoding, stock history, safe business edits, genuine reserved-order details,
  refresh/direct routes, failures, ownership and test isolation. Supported widths:
  375, 390, 430, 761, 820, 1024, 1280 and 1440 pixels.
- Existing owner/Marketing, application approval and customer gates remain enabled.

A passing fixture/browser gate does not substitute for an actual signed-in Clerk
journey on the final Vercel Preview. Keep PR #708 draft and unmerged until deployed
acceptance is established. Do not claim video transcoding, merchant activation,
payments or unsupported vendor order-state changes are complete.

## Product submissions and publication readiness (PR #708 next build)

The existing Product Catalogue now owns draft preparation, canonical category
selection, saved-product review, explicit confirmation, submission and the
resulting decision. Images & Videos remains the media manager, including main
image selection. There is no additional dashboard or review application.

### Authority and stored contract

`demeos_businesses.profile.products` remains the product authority. A managed
product contains `classification: {categoryId, sectorId, datasetVersion}` and a
server-maintained `submission` object. Classification references
`api/_lib/marketing-agent-categories.js` and its authoritative 9-sector,
171-business-category dataset. It does not replace the existing item-presentation
schemas (such as clothing options), which describe product fields rather than
those 171 business categories.

`submission` stores schema/ruleset version, state, content version/fingerprint,
creation/update timestamps, the vendor's reviewed fingerprint, validation
attempt, individual rule outcomes and append-only lifecycle history. History
includes actor/business/product identities, content version, timestamp, event
and validation outcomes; no storage credentials or model prompts are stored.
Only the existing authenticated server handler can initialize or change decisions.
Existing products without a lifecycle display Not submitted until explicit review
enrolls them; reading a legacy record does not fabricate a draft or change its
existing publication flag.
Ordinary business-profile saves retain server state and invalidate an edited
working version; incoming approval fields never grant authority.

| State | Meaning / permitted progression |
| --- | --- |
| draft | Private preparation; saved incomplete data is allowed. Review the saved version before submission. |
| validating | A persisted, version-bound attempt is running. Replays return its state; an interrupted attempt can be reviewed and retried after its 30-second lease. |
| changes-required | Deterministic or recoverable mandatory checks failed. Correct the saved product/media and review again. |
| review-required | Mandatory evidence is unavailable/inconclusive, interrupted or stale. The result is not approval. A fresh review permits another attempt. |
| rejected | A trusted mandatory rule returned a non-recoverable rejection for this version. No publication transition is permitted. |
| approved | Every applicable mandatory rule passed with exact-version evidence. Publication is a separate explicit server transition. |
| published | Publication readiness for a specific approved snapshot has been recorded; customer integration is not activated by this build. |

Product/variant/category/gallery/main-image edits advance the private working
version and clear its review/approval. The previous publication snapshot stays
immutable while a replacement is prepared. Repeated submission of the same
review and repeated publication are idempotent. A new review explicitly permits
resubmission. Catalogue compare-and-swap, fresh ownership/grant checks and a SQL
inventory/media evidence guard reject concurrent stale decisions. Failed final
writes cannot report approval; the persisted validating lease is recoverable.
No database migration, new product table or Production configuration is required.

### Checks actually implemented

| Rule | Current evidence / result |
| --- | --- |
| Business eligibility / ownership | Clerk identity, SQL ownership, existing Selling grant, or the exact isolated Preview grant. Preview never grants production publication. |
| Required data | Saved product name and description. |
| Category integrity | Exact canonical category/sector/dataset reference; unknown or mismatched references rejected. |
| Pricing | Applicable numeric fixed/from/range price or contact pricing. |
| Media integrity | Business/product relationship, completed ready state, actual processing results, private source/output paths and required derivatives. Physical products require a ready main image; services can be media-free. Pending, failed, missing or foreign references block approval. Filename alone is not evidence. |
| Stock / availability | Existing tracked balances and reservations, valid availability and stock identities. Untracked stock is not fabricated; services do not acquire artificial unit balances. |
| Content safety | **Unavailable:** no approved product-safety capability is installed. |
| Product/category consistency | **Unavailable:** existing category-understanding authority is not product-submission approval authority. |
| Product/media consistency | **Unavailable:** no approved media-consistency capability is installed. Not applicable to a service with no media. |

The existing shared semantic registry remains baseline-only. No model, API key,
endpoint, AI request or provider approval is activated. The server's internal
receipt boundary is deliberately unconfigured. A future approved capability must
provide independently verified exact-purpose, business/product/version/content/
media/environment/ruleset-bound, expiring decisions. Provider prose and client
flags cannot satisfy those checks. Tests inject clearly identified trusted server
fixtures to verify the successful/failed decision branches; these are not real AI
results and are not deployed configuration. Actual complete submissions currently
reach **review-required** until the mandatory services are genuinely approved.

### Future discovery contract and privacy

`submission.publication` contains state (`published` or `revoked`), ruleset,
source/deployment environment, approved version/content hash, immutable product
snapshot (excluding legacy image URLs and inline inventory audit), media fingerprint, validation receipts, publication time and actor.
`publicationEligible` is the server predicate for a future connector: it rechecks
real Production scope, current Selling eligibility, the approved snapshot/hash,
required rules, receipt expiry, inventory and the exact approved media set.
Private replacement uploads cannot substitute for approved media. Removed or
archived approved media, revoked publication or lost business permission stops
eligibility. Preview publication records always fail production eligibility.

Managed working products keep `customerVisible:false`, including after readiness
is recorded. That legacy flag is not approval authority. This build changes no
customer UI, Discover, search cards, Marketing UI or Admin UI, and does not
activate the existing customer campaign publication pipeline. A future connector
must consume the approved snapshot and server predicate, never the working copy
or a browser visibility flag. It must mediate authorized media delivery; private
storage keys and owner preview URLs are not public media contracts.

### Media, languages and verification limits

Existing Sharp/private Blob image handling is preserved. Main-image selection
persists, and failed/pending media can be removed before a genuine replacement
upload. Existing bounded media-worker retries remain in force. Video needs a real
configured inspector/transcoder; the Sharp Preview has neither video function.
It remains unavailable rather than reporting a simulated success.

New workflow copy uses the existing locale-keyed JavaScript approach, with
complete packs for the existing nine language codes plus Turkish. The current
Selling dashboard's English/Turkish selector is preserved; this is not a claim
that its older unrelated controls have all been translated into ten languages.
Canonical registry names remain the authoritative registry names.

`test/selling-submissions.test.js` exercises actual SQL plus binary uploads for
live and isolated Preview fixtures: drafts, review/confirmation, invalid category,
unsafe bytes, held/missing/expired/wrong-scope evidence, automatic decisions,
version preservation, API forgery, cross-owner rejection, concurrent edits/stock/
media and final guarded-write failures, lease recovery, reload and revocation.
The existing Selling browser gate additionally exercises actual draft controls,
multiple-image/main-image changes, review/submit/decision, reload and readiness
revocation on mobile/desktop. Successful approval uses isolated server receipts;
the default unavailable-capability path is tested separately and stays private.
An actual signed-in cloud Clerk/Blob acceptance is a separate check and must not
be inferred from the browser fixture.
