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
| Product Catalogue | Create/edit/delete uses the existing `demeos_businesses.profile.products` array and `saveSellingProducts` repository. IDs remain stable on retries. Profile revisions and SQL compare-and-swap reject stale writes. | Edits preserve publication flags, galleries, unknown extensions, variants and stock history. Structured price edits retain option/variant identities and override prices. Reserved items cannot be deleted. |
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
