# PR 708: Selling operations continuation

This continues `rebuild/selling-foundation-phase-1` from `98bb06f2bd7933907fc4dc54e069ddf8da61ffc8`. Keep the existing PR draft and unmerged. No Production release, credentials, data, Customer Interface, Marketing interface or Admin interface changes are authorized by this continuation.

## Implemented

- The existing Selling API has a SQL-backed catalogue view, tenant-scoped by persisted ownership and the existing application/test grants. Search covers product name, ID, SKU, recorded variant/stock SKUs and authoritative registry category name. Literal `%` and `_` remain literal, not SQL wildcards.
- Filters cover the existing category IDs, server-owned submission states, actual recorded validation rules, availability and stock. Validation `passed` means recorded checks passed; it does not invent an independent approval decision. Name, created/updated submission timestamps, numeric fixed/from price and available stock sorts have a product-ID tie breaker. Legacy records without timestamps remain undated.
- Pages contain at most 25 products. The offset is tied to the profile, inventory revision and query by a SHA-256 snapshot; concurrent edits require a fresh page. Offsets and all filter inputs are bounded and validated. Exact-product reads verify committed changes independently of the page/filter currently displayed.
- Product catalogue, media, variants and stock request product pages. Overview, My Business and Private Orders omit the catalogue/media payload. Overview media-attention counts use an owned SQL aggregate. Existing JSONB profile storage and atomic profile comparison remain authoritative; there is no second catalogue database.
- Product creation limit is 10,000, with the maximum still enforced server-side. Raising the old 100-record limit is not a claim of unlimited or million-business capacity.
- The existing catalogue editor now includes product SKU, identifiers, category, stock summary and real last-updated information. Product and variant SKU checks are business-scoped.
- Unsaved product forms use a session-scoped recovery record keyed by the authenticated identity and business, including the authoring revision and category fields. Refresh, language switching and business navigation preserve drafts. Explicit discard and leaving a dirty document prompt the user; sign-out removes the current business draft. Recovery is supplementary to SQL draft saving, and does not persist across a closed browser session.
- Product-specific revisions permit a save after an unrelated profile edit if that product is unchanged. A newer edit to the same product is rejected. The SQL update still compares the complete fresh profile, so a race during the save cannot overwrite other changes.
- Confirmed bulk availability changes affect 1–25 selected products in one guarded write. Cross-business IDs, duplicate IDs, stale profiles, stock conflicts and unavailable stock are rejected. Publication versions/decisions are reconciled through the existing submission lifecycle. Selected CSV export quotes fields and neutralizes spreadsheet formula prefixes. No mass deletion or invented archive state.
- A versioned category-field extension references the existing 171-category IDs. Initial specific definitions cover groceries (9), apparel (10), electronics (11), courses (39) and repair services (81). Other categories use the existing base product editor until relevant field definitions are reviewed. Unknown IDs and fields are rejected. Drafts may remain incomplete; normal saving and validation enforce applicable required fields. Previously saved attributes from another category are preserved. Existing approved snapshots remain immutable; legacy snapshots without the new attribute contract retain their existing rule set.
- Media ordering uses existing product galleries, exact ready-asset/product ownership, revision guards and audit reconciliation. It preserves the main image. Gallery images use existing private thumbnail derivatives when available. Videos retain actual playback controls and metadata-only preloading. No FFmpeg, Sharp, storage credentials or processing-provider configuration changes.
- Stock adjustments can update the actual low-stock threshold, with a reason and existing actor/timestamp/history audit. Inventory revision conflicts, negative/reserved-stock protection and transactional writes remain in place. Product stock summaries distinguish a wholly sold-out product from one with a sold-out variant.
- Private Orders has owned, read-only SQL search, existing reservation-state filters and 25-record keyset pages ordered by `(created_at, order_id)`. No customer identifiers are returned. An additive `(business_id, created_at DESC, order_id DESC)` index supports the tenant/page lookup. No payment or vendor fulfilment transitions were added.
- Overview adds real draft/correction, low/out-of-stock and media-attention counts. All seven sections, official branding/footer, ten existing locales and Arabic direction remain.

## API additions

Use the existing authenticated `/api/businesses?resource=selling-dashboard&businessId=...` contract.

| Operation | Additional parameters |
| --- | --- |
| GET catalogue page | `view=catalogue`, optional `q`, `productId`, `category`, `state`, `validation`, `availability`, `stock`, `sort`, `offset`, `snapshot` |
| GET metadata views | `view=overview` or `view=business` |
| GET order page | `view=orders`, optional `q`, `orderState`, `orderCursor` |
| POST bulk availability | `action=bulk-availability`, `productIds`, `availability`, `confirmed=true`, `catalogueRevision` |
| POST product save | Existing fields plus `sku`, optional versioned `categoryFields`; `productRevision` permits only a safe rebase after unrelated profile edits |
| POST stock adjustment | Existing fields plus optional `product.lowStock` |
| POST media ordering | `action=move-media`, `product={productId,assetId,direction:earlier|later}`, `catalogueRevision` |

Authentication, persisted ownership and Preview grants are checked before these reads/writes. Errors retain the existing private/no-store response boundary. Caller-provided business IDs, cursors or product IDs never grant access.

## Local measurements

See `pr708-catalogue-performance.json`, generated by `node tools/measure-selling-catalogue.js`. Node v24.19.0; PGlite 0.5.8; one warm-up and eight measured reads per operation. These are isolated SQL page measurements, excluding authentication, full profile hydration, private-media signing, network and UI rendering.

| Products | Page median | SKU search median | Maximum products returned |
| --- | --- | --- | --- |
| 5 | 2.55 ms | 2.98 ms | 5 |
| 500 | 7.76 ms | 8.05 ms | 25 |
| 5,000 | 48.33 ms | 46.62 ms | 25 |

The 5,000-product page result was 4,962 JSON bytes. The existing JSONB array still requires per-business expansion/filtering and the authoring path still hydrates and compares the profile. This remains O(n) work inside one business and is not proof of million-business scale. A future measured normalization of product persistence can keep these API contracts.

## Verification and remaining dependencies

- Full local suite passed 1,523 tests, no failures/skips, before the final small stock-summary/media-order guard refinements. Focused SQL/media tests and the unchanged complete CI workflows verify the final code; final run IDs/status belong in the delivery report.
- Added actual-SQL tests cover catalogue search/filter/sorts/pages, query injection rejection, ownership, stale snapshots, bulk writes, required category fields, retained attributes, safe profile rebase, stale product rejection and genuine reservation keyset pages. Actual image-byte tests now also reorder saved images and preserve the main image.
- The expanded browser gate checks real SQL pagination/filtering, bulk availability, category fields, refresh recovery, Arabic form retention, unrelated-profile saves and same-product conflicts, alongside the existing seven-workspace, logo/image/submission/stock, ten-language, footer, privacy and responsive gates. It retains all eight widths and both CI browser engines.
- Native video verification actually encoded 3-second audio and 60-second silent MOV files, verified private outputs, SQL ready state and gallery linking. Local full Chrome playback could not launch because the host rejects Chrome's process-singleton socket. The existing real-video CI gate remains required; no physical Safari claim is made.
- Vercel metadata confirms branch-specific Preview database/test/video settings. Sensitive database values are withheld by the connector, so this session cannot independently compare actual Preview/Production hosts. No deployed test data was written. Deployed authenticated acceptance requires verified isolation plus an authenticated owner session; do not infer it from fixture tests or signed-out page checks.
- Independent content-safety/category-fit/media-consistency validation services remain a real dependency. Unsupported submissions stay held with genuine recorded reasons. No fake automatic approval or new manual Admin dependency is introduced.
- Real iPhone/iPad Safari acceptance remains required. Further category definitions need appropriate business-field requirements. Read-only order state transitions and payments remain outside this assignment.
