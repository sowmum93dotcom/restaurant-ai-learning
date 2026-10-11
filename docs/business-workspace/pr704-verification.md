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

The remaining product editor help, placeholders, fulfilment descriptions, pricing and variation controls, media fallback and product validation are translated across all nine languages. Language switches preserve input values, business-provided choice labels and exact stored records. The expanded browser gate verifies the translated validation and field copy. This does not claim translation of every unrelated legacy Marketing screen.

The local Chromium codec could not decode the fixture MP4. Exact video identity, inline controls and fallback are verified, but playable video acceptance on real iPhone/Safari and production storage remains outstanding.

Production `/selling-vendor` was opened in the browser and reached the correct sign-in gate. No authenticated authorised production business-owner session is available, so private live catalogue, media storage and live order inspection cannot be claimed.

Live payment processing and customer ordering remain inactive. The existing private recorded-order foundation is preserved. No verified sales reporting contract exists, so no sales figures were displayed.

PR must remain draft until remaining visual/language/video acceptance and full CI/review requirements are satisfied. The current work is not a production release and must not be represented as one.

## Completion pass, 11 October 2026

Completed remaining Selling product editor copy using the existing vendor catalogue and category language architecture. Generated interface labels are separate spans so translating a label cannot remove its input. User-provided names, descriptions, price strings, choice labels and variants are not translated. Dynamic option and pricing controls keep their existing state during language changes. Main editor fields now have consistent full-width sizing, 44px minimum targets, 16px text and visible keyboard focus.

Full Node suite: 1,471 passed, zero failed. Owner SQL/API/browser acceptance passed at 390, 820 and 1440. Selling SQL/API/browser acceptance covers exact product/variant edits, all-nine-language placeholders and fulfilment text, translated missing-name validation, gallery/main-image persistence and order, removal from gallery, retry and failed-save recovery, stock/history/CSV and private orders. These are controlled isolated database/storage tests, not production media storage acceptance. Gallery removal does not physically delete the original storage object. No storage deletion capability was added.

Production was inspected at https://www.demeos.io/selling-vendor and reached the correct unauthenticated sign-in gate. Production Vercel deployment dpl_ZPkf5tNzj2X9QX5jyX2xyTX3wim8 is READY on PR703 main cffe77c0021001cdbcd5c2305fc4ef6fb5741c64. No authorised production vendor session is available. Native Safari/iPhone testing is unavailable. No playable-video or production storage pass is claimed.

Independent review remains unresolved for this completion pass. The earlier GitHub Codex review request returned an account usage limit. Automatic approval review rejected the local independent Codex review because it could transmit private code to ChatGPT’s external service without specific authorisation for that destination. No review result is claimed and the rejection was not bypassed.

Release decision: keep PR704 draft and unmerged while production storage acceptance and independent review remain unresolved. Record physical Safari/iPhone playback as an unperformed test. Payment processing and live customer ordering remain disabled; no payment or order activation code was changed.

Latest completion screenshots: `pr704-evidence/demeos-owner-vendor-catalogue-{390,820,1440}.webp` and `pr704-evidence/demeos-owner-vendor-editor-{390,820,1440}.webp`. These show controlled isolated products, not live vendor inventory. A separate CLI production-readiness run stopped on an environment certificate trust error; it is not recorded as passed. The cloud-browser public Selling entry inspection did succeed.
