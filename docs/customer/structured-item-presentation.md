# AREA 1 structured product and service presentation

Issue #656 adds an optional `presentation` to the existing customer-visible product contract. Existing legacy products remain supported. Public API validation and browser validation use `js/customer-item-contract.js`; malformed structured items are omitted rather than rendered with invented values.

Controlled fixtures remain behind the existing exact query/header activation. They are never persisted as business records. Normal production requests do not receive them. Supplied media associations remain unchanged; the grocery pack intentionally has no product image because its supplied artwork belongs to business marketing.

## Receiving shape

- `categoryId`: one of the controlled leaf categories exported by the shared contract.
- `pricing`: `fixed` or `from` with numeric `amount` and supported ISO currency; `range` with ordered `min`/`max`; `none`; or `quote`.
- Optional `options`: only fields relevant to that category, with unique values and customer labels. Controlled fixtures use validated copy keys from the existing nine-language interface catalogue.
- Optional `variants`: unique IDs and complete selections of declared options, availability and optional pricing override. Duplicate or invalid combinations are rejected. An undeclared combination cannot continue.

The category contract distinguishes products and services. Fashion supports size/colour; groceries support weight/quantity/pack size; services support duration/location/people/date. Fields are optional. Products without options do not receive irrelevant controls.

Base unavailability always blocks continuation. Available/limited/contact selections retain the original business-approved external destination. Selected options are displayed for confirmation with the business; no undocumented third-party URL parameters are added. The explicitly granted DEMEOS continuation remains inactive, with no payment request or economic mechanism.

Language selection and persistence remain in the existing Customer Interface language controller. The added catalogue supplies content to that controller, including prices, categories, selection labels, values, availability and guidance. Real business-provided names and custom option labels remain business content.

## Verification

Run `npm test` and both scripts in `browser-checks/` against a static server on port 4173. The controlled media gate checks all nine languages at phone, tablet and desktop widths, exact media ownership/aspect ratios, playback, navigation, continuation, selected/unavailable combinations and separation from normal mode.
