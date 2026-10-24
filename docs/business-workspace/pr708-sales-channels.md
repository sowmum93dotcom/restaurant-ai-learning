# Selling sales channel separation

The existing seven-workspace dashboard now distinguishes B2C individual customers, B2B business buyers and both. This is one catalogue and stock ledger, with separate commercial terms. It does not create a second dashboard, category registry, buyer identity or order service.

## Saved authoring contract

- `businessProfile.salesChannel`: `b2c`, `b2b` or `both`. Missing legacy settings retain the existing B2C behaviour. Invalid explicit settings fail closed at consumer boundaries.
- Each product saves its own `salesChannel`, constrained to the business's enabled channels. Enable both channels before moving existing products between them; narrowing a business mode cannot strand incompatible products.
- Retail price fields retain their existing contract. B2B and both-channel products additionally save `businessTerms`: quote or fixed wholesale price, explicit ISO currency, unit price, minimum quantity, pack size and up to five ordered quantity discounts. No currency is inferred from country or IP.
- Quantities must be positive safe integers and whole packs. Discount thresholds strictly increase and prices strictly decrease. Prices respect the selected currency's minor-unit precision. Quote terms cannot silently retain fixed prices or discounts. Returning to B2C removes wholesale terms.
- Terms use the existing ownership checks, catalogue/product revisions, atomic SQL update, submission reconciliation and draft publication restrictions. Stock identity does not include channel or price and remains shared. No stock migration, duplicated product or database schema change is introduced.
- Saved business and product forms verify the returned values. Product draft recovery and language changes retain channel and wholesale fields. The catalogue shows channel labels and supports SQL channel filtering across pages.

## Consumer and order boundaries

B2B-only products are excluded from the consumer public-work projection and rejected by the consumer reservation route. Both-channel public projections expose only the existing retail whitelist, never wholesale terms. The checkout eligibility predicate also checks consumer channel eligibility against authoritative inputs.

New reservations produced by the existing customer-only service are marked `salesChannel: b2c`. Private Orders provides server-side channel filtering and displays recorded channels. Historical orders without a recorded channel remain `unrecorded`; the UI never infers their buyer type from today's product setting. No B2B order is fabricated.

Business buyer verification, B2B quote requests, B2B checkout, company invoice details, credit terms and business payment handling are not implemented or activated by this change. The dashboard explicitly explains that saving business terms does not enable these purchase workflows. Fixed wholesale terms are saved authoring data, not a claim that direct B2B purchasing is live. The existing customer-only reservation service continues to reject business-owner identities. A future business buyer service must independently establish buying-business ownership/verification and validate channel, exact terms, quantity/pack/tier, tax/currency, reservations and payment readiness on the server; a browser-supplied `b2b` flag cannot supply that authority.

## Verification

Real PGlite integration checks cover ownership, revision conflicts, product and business persistence, channel constraints, SQL catalogue/order filtering, rejected partial updates, currency precision, pack/tier validation, shared stock identity and consumer projection/reservation guards. The existing rendered SQL browser gate now saves a both-channel business and product, independent retail/wholesale prices and discounts, refreshes and edits them, verifies all ten locales retain unsaved terms, filters B2C/B2B records, and cleans up its isolated data. Existing media, variant, stock, language and access gates remain in place. Browser evidence is isolated test data, not real trading or physical iPhone/iPad Safari acceptance.

PR #708 remains draft. Production merge and activation are not authorised.

## Owner wholesale price calculator — 20 October 2026

Each saved B2B/both-channel catalogue product now offers a quantity calculator in the existing card. `POST estimate-wholesale` accepts only a saved product ID and integer unit quantity inside `product`, plus the current catalogue revision. The existing authenticated ownership, Selling access and isolated Preview checks run first. The server reloads authoritative terms, enforces both business/product B2B eligibility, minimum quantities and whole packs, then applies the highest eligible quantity tier. Caller prices, currencies, variant IDs and terms are rejected. Stale catalogue revisions return 409.

Money is calculated with integer minor units using BigInt, including zero- and three-decimal currencies and results beyond JavaScript's safe integer range. Exact decimal strings are returned. Quote products explicitly return `quote-required` without any invented price. No catalogue, inventory, order, payment, buyer verification or publication write occurs. This is a product-level merchandise estimate; tax, delivery, variant pricing and stock availability are excluded in the visible wording. It does not activate B2B purchasing or buyer quote submissions.

The card clears obsolete results when quantity changes and ignores late responses after account, business or rendered-card changes. The controls and result labels use all ten established locales. SQL integration checks cover authoritative prices, authorization, stale revisions, forged parameters, currency precision, whole packs, quote-only terms and unchanged profile/stock/orders. The existing rendered browser gate adds base-price/discount totals, stale-result clearing and no-created-order checks at all eight widths. Current validation and deployment status are reported in the PR rather than inferred from prior runs.

The selected-record CSV export now has explicit channel, retail price, wholesale method/currency/unit price, minimum, pack and quantity-tier columns. B2B-only records omit obsolete retail prices; B2C records omit wholesale data; quote-only records omit fixed prices. Export remains private to the selected loaded records, escapes CSV syntax and spreadsheet formula prefixes, and creates no external share. The existing price sort is labelled Retail price and puts B2B-only records after priced retail records instead of sorting by hidden obsolete retail values. SQL and rendered-download checks cover these distinctions.
