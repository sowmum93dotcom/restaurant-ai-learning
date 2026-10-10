# Selling vendor inventory and catalogue

Baseline: PR 700 merge 68c0b3f22c459368d84872fe02e5c077fc0aacfd.

## Implemented

Existing Selling workspace adds Stock navigation. Exact saved product and variant identities resolve to private stock rows in the existing Postgres database. Counts start unrecorded, never inferred. Vendors can save whole-unit counts, unique stock codes and low-stock thresholds with a reason, review adjustments, filter/search, import/export stock CSV and inspect the latest 30 adjustment batches. Batch saves support 100 changed rows. Services have no unit stock; offers with choices must have exact saved combinations.

Writes recheck database ownership, saved Selling/Both intent, business catalogue snapshot and inventory revision. Atomic SQL updates append an adjustment record together with stock. Foreign identities, stale revisions and catalogue changes cannot overwrite stock. Each balance includes a signature of the exact category and option selection. Reusing a variant ID for different options blocks stock editing instead of transferring the balance. Direct catalogue saves reject reassignment of recorded combinations. Client fields cannot set reserved quantities. Existing stock is private preparation; no order reservation writer is installed and reserved remains zero for new rows.

Selling catalogue reuses the existing editor and category definitions. It has a collapsible editor, search, direct reviewed product save without navigating through business setup, and duplication with new product/variant IDs, hidden customer visibility, and no copied stock or gallery references. Product saves use current server profile validation and optimistic concurrency, preserve supported options and server extensions, and return the private submission state to draft.

Existing secure media upload accepts up to 20 files in one selection, with exact saved product association for Selling and per-file processing/errors. Failed selections are retained for retry; successful files are removed from the retry selection. Retries retain each file’s original business/product and upload session. A successful storage PUT is not repeated when completion fails; the same asset completion is replayed. No transport, processing, private delivery or publication security is bypassed. Private gallery preparation supports up to 20 exact ready asset references, main image selection and ordering. The server validates every asset against the same business and product; no browser URL grants approval. Saved gallery references are retrieved alongside the latest 100 uploads, so older product galleries remain visible. Gallery order/main image is private preparation metadata and is not yet consumed by public Customer Experience publication.

Selling-intent businesses see the Selling workspace without the Marketing switch. Shared preparation permissions and live selling authorization are unchanged. New stock, catalogue and gallery copy covers all nine supported languages, including removal and limit prompts. Selling galleries exclude unrelated Marketing assets. Existing owner-entered facts remain in their original language.

## Verification

1,456 Node tests passed, including the new regression cases. New tests exercise real PGlite SQL, exact variants, quantity validation, reserved protection, unique codes, atomic history, stale snapshots, foreign/anonymous/marketing API denial, optimistic product saves, CSV safety and nine-language label completeness.

New actual API/SQL/browser gate verifies stock save and reload, reviewed multi-row CSV updates, search, nine-language gallery controls and prompts, private gallery/main image and ordering, multiple uploads through actual registration/completion APIs, individual failure retry without resending successful files, failed stock/product save recovery, hidden product duplication and no horizontal overflow at 390/820/1440. The expanded gate advances freshly uploaded assets through the actual SQL queue/lifecycle using an isolated processor result, saves two of those images, then reopens and verifies rendering/order after 101 newer uploads. It also simulates a lost successful completion response and verifies one registration/upload plus two completion requests for that file. It captures screenshots at /tmp/demeos-owner-vendor-{stock,catalogue}-{width}.png. The existing owner gate continues to check product/options preparation, authentication, private submission, marketing permissions and results. Browser fixtures use isolated owner identities, local SQL and controlled media only, never production writes.

## Not complete or activated

Live checkout still has no configured provider or merchant quote loader. The payment store is an isolated test-mode store, not a vendor order source. No orders, fulfilment, cancellations, returns, live reservations, automatic sale deductions, settlement or verified sales reporting are exposed as operational. This release cannot prevent live overselling until atomic reservations and verified purchase events are integrated with the live purchase contract.

Product drafts still use the existing explicit saving behavior. Full catalogue import, bulk product pricing, automatic product-draft saving and service scheduling are not implemented in this release. No separate application, authentication system, category catalogue or approval system is created. Payments, external AI, Admin and Customer Experience publication are unchanged.

## Required purchase connections before live selling

The inspected entry point is `api/_lib/customer-checkout.js`. It currently resolves controlled fixtures and calls `createPaymentService().begin()` with no configured provider or merchant quote loader. `api/_lib/customer-payment-contract.js` freezes businessId, productId, selection, quantity, prices, merchant account and fulfilment reference in a test quote; it does not carry an authoritative variantId or inventory reservation. `api/_lib/customer-payment-store.js` persists only `demeos_customer_test_payment_attempts`. Its `reserve()` reserves a payment attempt, not units of vendor stock.

| Capability | Required authoritative connection |
| --- | --- |
| Order creation | A private merchant quote loader must resolve the approved current business/product and exact variant ID, verify seller activation/account, prices and supported fulfilment, then freeze that identity into a separate authoritative order contract. Controlled fixtures and test receipts cannot supply vendor orders. |
| Reservations | Order creation must atomically reserve available units for the resolved business/product/variant and signature, under catalogue/revision checks and an idempotent order key. The server alone owns reserved quantities; vendor adjustments cannot set them. |
| Payment settlement | Verified provider notification and reconciliation must feed idempotent authoritative order transitions. Stock moves only on the agreed order lifecycle event, never a browser success URL. The existing test-only gateway contract must remain test-only. |
| Fulfilment | An owned order and verified fulfilment record must record allocation, dispatch/collection and completion without decrementing twice. The current quote fulfilment reference is not a fulfilment system. |
| Cancellation/expiry | An authoritative order transition must release its own remaining reservation exactly once. Paid orders require the appropriate payment/refund workflow before settlement changes. |
| Returns | Verified returned quantities and disposition must drive explicit inventory adjustments against the original variant identity. A refund by itself cannot restock physical units. |
| Customer gallery | Existing publication approval must explicitly consume the private gallery order/main references and validate their exact ready business/product assets. A private gallery save grants no approval. |

Production was verified READY at the baseline SHA above before this change. Local SQL fixtures are isolated and never write production records. The media completion endpoint needed a narrowly scoped repair of invalid literal newline text and incorrect relative imports; its token verification, storage checks and processing queue are retained. Marketing keeps its original single-file upload behavior.

## PR 701 browser gate correction

The failed run 38041216454, job 114181675682, timed out at `.vendor-stock-row.first().waitFor()` after catalogue duplication. A previous “Products saved” status remained visible during the next save, while Stock navigation occurred with the product request pending. Stock loading was skipped during that request, then its cached rows were invalidated without loading the newly selected Stock screen. Product saving now clears the stale success status, and finalization reloads Stock when needed. A deterministic browser regression holds the actual product PUT response while navigating to Stock. Existing assertions and authorization remain intact.

Independent review identified and prompted correction of saved galleries beyond 100 recent assets and completion-stage retries. The expanded browser gate covers both findings in actual API/SQL flows.
