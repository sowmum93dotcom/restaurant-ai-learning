# Selling order and stock reservation foundation

## Inspected baseline

PR 701 merge a750984be9a7652bd2a17be2a62d3570dabf46ab and its www.demeos.io production deployment dpl_AUmTkCtncHRR9PqLUXAK71ZiEP4w were verified READY before implementation. Read vendor-inventory-verification.md. Existing stock rows, exact variant signatures, revision checks, owner permissions and stock history were reused. Existing checkout and demeos_customer_test_payment_attempts are controlled payment preparation, not authoritative vendor orders. No genuine order or fulfilment contract existed.

## Implemented boundary

The existing Postgres persistence adds private vendor orders, durable idempotent request outcomes and order events. This is an extension of the existing database, not another catalogue or registry. The server-only foundation in api/_lib/vendor-orders.js has no customer order-creation HTTP endpoint and no payment caller. Its default purchase authorizer reads existing server readiness, whose canSell remains false. Private preparation access and saved Selling/Both intent do not grant purchase authority. There is no environment switch or owner editor action to activate this writer. Isolated SQL tests supply a server-only purchase authority dependency; no deployment uses it.

A request contains only exact business/product/variant, option selection, quantity, catalogue revision and expected stock signature. The server locks the saved business row, checks its exact identity, saved intent, server selling authority and customer role, then locks inventory. It resolves current product and exact combination, availability and fixed structured price from that saved profile. Variable/quote prices and service unit stock are rejected. Currency precision is resolved server-side; the snapshot stores safe integer unit/total minor amounts, currency, exact selection and stock identity. Unknown fields, supplied prices and controlled test identities are rejected. No controlled checkout/payment record is imported.

Pinned transactions use the existing Postgres pool connection and BEGIN/COMMIT/ROLLBACK. PGlite uses its native transaction API. There is no transaction issued against an unpinned pool. Business-first locks serialize catalogue/stock changes; current inventory is read after the lock. Available units, order, reserved count, inventory revision, stock history, idempotency receipt and order event are committed together. Any failure rolls all mutation back. Browser code cannot set reserved counts; existing adjustment validation and compare-and-swap revision checks remain in force. Returning to Stock refreshes current counts when there are no unsaved edits.

The durable request key is scoped to authenticated server-supplied customer identity. Equal purchasing facts replay their frozen original result, including terminal catalogue/stock failures after authority checks. Different facts conflict. An original reservation response can describe an order that was subsequently released: future purchase/event consumers must read the authoritative current order, not treat a replayed creation receipt as an active hold.

## Cancellation and expiry

Only unpaid reserved orders are supported. Customer cancellation requires the same trusted identity as the order. The internal expiry transition requires the server worker actor and checks persisted deadline against database clock time. Each releases that order's remaining exact reservation once, records its event/history atomically and sets remainingReserved to zero. Identical release retries return persisted state; conflicting transitions and paid-state claims are rejected. These transitions do not refund, cancel payments or decrement physical stock.

expireDue processes up to 100 persisted due records per call. No scheduler, timer, cron route or public expiry endpoint is installed. Existing vercel.json has no reliable expiry schedule. A durable authenticated server worker, scheduling/catch-up/retry/monitoring and production transaction acceptance are required before live reservations can be enabled. A closed browser is irrelevant to expiry state. Live creation stays disabled while this dependency is missing.

## Workspace

The existing Selling workspace adds a private read-only Orders destination. Primary navigation remains compact: Overview, My Business, Product Catalogue, Stock, Orders. Existing Options remains accessible within Product Catalogue. Marketing navigation is unchanged and marketing-only businesses cannot access the stock or orders APIs. The owned Orders query rechecks business ownership and saved Selling/Both intent, returns the latest 50 real authoritative records and excludes customer identity/contact data. No payment attempts, test receipts or invented analytics appear there. The current empty state accurately says live ordering is not active. New text reuses vendor-inventory-copy in English, Spanish, French, Portuguese, German, Arabic, Chinese, Hindi and Japanese. Private rows are cleared on sign-out or business/model changes; late responses cannot repopulate them.

## Verification

Focused real SQL tests cover exact variant/selection and authoritative price snapshots, insufficient stock, concurrent competing reservations, identical concurrent retries, idempotency conflicts and preserved failure outcomes, permission/owner/customer-role denial, stale catalogue/signature, price precision/availability, preserved retry snapshots after price edits, cancellation/expiry release once, invalid transitions, history-trigger rollback and concurrent manual adjustments. The pinned pool adapter is checked for connection-local commits and rollback/release. Controlled test payment records coexist separately and cannot supply orders.

The existing actual API/SQL/browser inventory gate now verifies Orders empty states and all new text in nine languages at 390, 820 and 1440 pixels, renders isolated authoritative orders, verifies ownership and GET-only protection, checks customer identity is absent, retains catalogue/stock/gallery regressions and checks sign-out/private API denial. Isolated recorded orders and server authority exist only in the local test database. Screenshots /tmp/demeos-owner-vendor-orders{-empty}-{width}.png are retained in the required GitHub browser artifact. Genuine authenticated production ordering is not claimed.

## Remaining production prerequisites

Before any live selling: existing authoritative business/product publication and explicit merchant/selling authorization must be completed; a private merchant quote loader must resolve the exact current order identity using trusted authentication. Selling authorization must be rechecked against authoritative server policy inside the locked transaction; the isolated test authorizer must never be used. Production multi-connection concurrency and rollback acceptance, schema readiness and reliable expiry worker operation must be proven first.

Verified provider events/reconciliation must later use the authoritative order and idempotent event identity, compare frozen amount/currency/customer/merchant facts and apply guarded order transitions. Sale deductions must be atomic and exactly once on the agreed verified lifecycle event, not a browser success URL. Fulfilment allocation, dispatch/collection, settlement, returns/refunds and sales reporting require their own future contracts. Payment architecture/provider configuration, fees, Marketing development, AI search, Admin Control and public Customer Experience publication were not changed. No production test business, genuine order, payment or approval is created by verification.

Final workflow, review, merge and exact production evidence is recorded in the PR release report.
