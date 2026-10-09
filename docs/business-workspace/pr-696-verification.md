# PR #696 — Automatic category fields and simple owner setup

Baseline: verified latest main `dbfd90904943b23ec833b19b937336b6d2e15540` (PR #695).

## Inspection and focused changes

Owners were already able to select a category and receive fields from `DEMEOSCustomerItemContract.categories`; no manual attribute creation or mapping was required. The missing improvements were clear optionality, direct field visibility, category-neutral combination language and an honest fallback.

- Category fields now appear immediately after selection. Clothing supplies size/colour; groceries supplies weight/quantity/pack size; sports, outdoors and appointment services supply duration/location/people/date; toys supplies no additional fields. These are the six existing authoritative templates. No restaurant mapping or additional schema is invented.
- General product or service keeps the existing description, price and continuation editor for other categories. It does not invent structured attributes.
- Choices are optional. Marketing owners need not enter stock combinations or individual selling prices. Combination-specific prices and availability are folded into an optional section. Existing variants open that section, display saved owner labels and retain exact identifiers and selections.
- Saved categories with choices remain locked. Adding a new option dimension requires explicit selection for each saved combination; duplicates/incomplete combinations fail the existing contract. No automatic combinations or prices are inferred.
- New guidance uses the existing nine-language controller, registry and preference. Owner facts remain unchanged. Surrounding legacy English controls are not claimed fully localized.
- Existing save, accuracy review, matching media, private draft and administrative submission flow is preserved. No API, authorization, payment, Customer Experience or Admin implementation is changed.

## Release verification

The expanded owner browser gate uses actual APIs and PostgreSQL-compatible PGlite with isolated engineering identity fixtures. It checks every supported category at 390, 820 and 1440 pixels, no required choices, no generated combinations, fallback, saved labels/IDs/extensions, duplicate rejection, exact media, ownership isolation, private Unapproved submission and sign-out. Existing model-readiness and customer regression gates remain mandatory.

Rendered evidence: `/tmp/demeos-owner-product-editor-{390,820,1440}.png` and `/tmp/demeos-owner-category-{groceries,services,general}-{390,820,1440}.png`; the existing browser workflow uploads these. They show engineering fixtures, not genuine production owner sign-in.

Required before merge: full Node suite, both GitHub workflows passing on the exact final head, actual original H264 playback in required Chrome CI, rendered review, no unresolved genuine findings and READY preview. Local unsupported-codec fallback alone is insufficient.

Required after merge: production READY for the exact merge SHA and read-only live anonymous owner/authentication and Customer Experience checks at all supported widths. No production test data, genuine accounts, public onboarding or payments.

## Remaining work

New category definitions require authoritative contract development. Genuine approved-business usability validation, full legacy workspace localization, administrative publication and selling activation remain separate work. Stop after PR #696.
