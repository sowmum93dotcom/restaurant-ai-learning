# PR 694: business owner product and marketing preparation

Baseline main and the www.demeos.io production deployment were verified at PR 693 merge b6722629596a25a526ca682909da5e91a47f5b08, READY. Its implementation/verification document was inspected before editing.

## Existing functionality retained

The same three owner pages, five primary areas, business profiles/products, campaign lifecycle, media storage/processing, owner authorization and sign-in are retained. Factual draft preparation already existed in PR 693 and remains a mode of the same generate API. Prepared drafts still cannot be owner-approved or publicly projected. Existing checkout, payment/authentication, Customer Experience, 171 business categories, search, Admin Panel and economic architecture are unchanged. No deployed data is created and no external provider or onboarding is activated.

## New functionality

The existing product editor uses the existing customer item contract to author its six currently supported structured presentation categories, numeric fixed/from/range/quote/no-listed prices and currency, option labels/choices, existing variant price/availability and new owner-selected variant combinations. This is an authoring adapter, not another catalogue. Other offers retain the business category and existing general price/contact fields. Existing option values, copy keys, product/variant IDs and saved future extensions are retained. Categories with recorded options cannot be silently changed. New choices without a recorded matching variant do not become available automatically. Specific variants are explicitly owner-selected with a visible contact availability default; no stock or prices are inferred. Removing existing choices/variants is not supported by these controls; owners can mark variants unavailable.

Server profile saves reject foreign business product IDs and preserve omitted presentation/options/variants and saved unsupported extension fields from the authoritative owned record, never from unvalidated incoming fields. Older editors cannot silently change structured prices without presenting the structured contract. Saved profiles are rehydrated from the server, including newly authored services. Existing review/accuracy confirmation and business submission contracts remain in use.

Products have a Prepare marketing action into the existing Create panel. The saved offer review, matching media selection, six preparation steps/current step and next action connect review, save, media, factual preparation, manual editing and private submission. Pending/unsaved product changes block preparation. Unsaved draft text blocks submission. Submission rechecks the saved owned offer and current ready matching media so a deleted/reassociated asset cannot be accepted.

Images and videos have owned offer captions and visual previews. Video stays inline, with controls and no autoplay. Hidden/replaced previews pause playback. Media registration distinguishes structured services and products and rejects incorrect related types. A full-image square preview frame is optional, uses contain (no crop), and is explicitly preview-only: source bytes, stored assets and public/customer presentation do not change. Unsupported/failed previews show a truthful fallback instead of substituting media.

Factual drafts now present the saved offer first and use authoritative structured prices, option labels and variant facts, rather than conflicting legacy price text. Availability does not imply all variants are in stock. Oversized/invalid facts fail closed. Business-controlled text remains unmodified; no discounts, credentials, features, stock or prices are invented. Every draft remains editable, private and Unapproved.

Preparation guide/steps use the existing nine-language registry and shared preference. Supported category and option headings reuse existing nine-language item presentation copy. Business facts remain in their original language. This prepares the new presentation for international use without a new translation engine. The surrounding legacy owner workspace and several authoring labels/statuses remain English; full owner translation is not claimed.

## Verification and release gates

Focused Node/API tests cover omitted structured data, exact choice/variant identities, retained extensions, invalid prices, cross-business claims, structured/legacy price conflicts, service facts and draft accuracy/privacy. The real HTTP owner API → existing repository → isolated PGlite browser gate covers 390/820/1440: product and service authoring, variant edits/new combinations, matching image/video previews, non-destructive framing, nine guide languages, foreign denial, unsaved draft submission, exact media, relationship recheck and private/public separation.

Local Chromium lacks H264/AAC decoding: its inline original identity and accurate unavailable-preview fallback are tested. The initial release CI Chromium had the same codec limitation and correctly failed the playback requirement. CI now installs Google Chrome and explicitly selects that channel for both owner media and existing controlled customer media gates. It must support and actually play the original supplied H264 video; all playback assertions remain mandatory. No original asset or browser check is weakened. Run the full Node suite, existing customer regressions, exact-head GitHub checks, code review and protected preview boundary checks before merging; then verify the exact merge production READY and live read-only owner/customer boundaries.

## Remaining requirements

Administrative acceptance/publication of prepared drafts remains pending; submitting does not make them public. Genuine selling and payment activation remain gated by existing merchant architecture. Additional structured category support, removal/reorganisation of existing option identities, full owner translations, configured preview authentication, real-owner provider login/account write verification, intelligent image generation and complete product event analytics remain separate work. No originals are transformed and no real businesses are invited or published.

Stop after PR 694. Do not start another assignment.
