# PR 704 Selling Vendor professional experience

Baseline main: cffe77c0021001cdbcd5c2305fc4ef6fb5741c64 (PR 703). The existing PR 704 branch was inspected before changes. Production Vercel was READY at that baseline.

## Implemented

Selling uses a distinct navy navigation and pale operational canvas, gold active actions, saved product cards, responsive media previews and a closed Add Product editor. The Marketing premium stylesheet is disabled only after trusted Selling access is resolved; Marketing retains its existing theme. The existing application routes, database, authentication, catalogue, categories, media pipeline, stock and order services are reused.

Exact ready main gallery images render on their own product cards only when business, product and gallery membership match. Existing fallback product images remain supported. Search persists across media and language rerenders. Editor updates retain the exact product and saved variant identities. Add and Cancel close or open the editor appropriately; Add from Options returns to the complete product editor. Removing an unsaved product cannot operate stale gallery controls.

Existing supported multiple image/video uploads, failure retries, processing lifecycle, gallery ordering, main images, private stock adjustments and history, CSV review and private recorded orders remain intact. No sample products, fabricated sales, new order writers, payment activation or publication permissions were added to production.

Primary catalogue, editor, media, status, navigation, stock and order controls use all nine supported languages. Category and variant fields continue to use the authoritative existing definitions and language catalogue. Business-provided facts remain in their original language.

## Verified locally

The Node suite passed 1,471 tests with zero failures. The owner SQL/API/browser gate passed at 390, 820 and 1440 pixel widths, including marketing-only, selling-only, dual grants, denied access, owner onboarding, authoritative category choices, variants, matching image/video identity, private submission, results and sign-out.

The expanded Selling browser gate passed at those widths against real owner endpoints and isolated PGlite SQL. It verifies stock save/reload, history, failed save recovery, reviewed CSV changes, private orders, foreign/anonymous denial, multi-file registration/completion and retries, exact ready gallery/main references, gallery retention after 101 later uploads, unsaved removal, exact edited product/variant preservation, duplicate isolation, real search visibility after rerender, nine-language controls and no horizontal overflow. Additional realistic visual products and their matching images exist only in the isolated local database.

Independent Codex review identified search rerender, hidden CSS, editor, language and stale gallery weaknesses. They were corrected and verified. Review found no new server permission or publication-control issue.

Screenshots are in [pr704-evidence](pr704-evidence). Catalogue and populated editor screenshots cover iPhone (390), tablet (820) and desktop (1440), with additional dashboard, stock and private-order evidence. These are isolated engineering records, not live vendor accounts or live orders. Screenshot inspection was used to identify and correct inherited CSS conflicts; passing tests alone were not treated as visual acceptance.

## Remaining release limitations

Some inherited editor help text, placeholders, fulfilment descriptions and validation messages remain English. Full translation of every legacy Business Profile message has not been completed.

The local Chromium codec could not decode the fixture MP4. Exact video identity, inline controls and fallback are verified, but playable video acceptance on real iPhone/Safari and production storage remains outstanding.

Production `/selling-vendor` was opened in the browser and reached the correct sign-in gate. No authenticated authorised production business-owner session is available, so private live catalogue, media storage and live order inspection cannot be claimed.

Live payment processing and customer ordering remain inactive. The existing private recorded-order foundation is preserved. No verified sales reporting contract exists, so no sales figures were displayed.

PR must remain draft until remaining visual/language/video acceptance and full CI/review requirements are satisfied. The current work is not a production release and must not be represented as one.
