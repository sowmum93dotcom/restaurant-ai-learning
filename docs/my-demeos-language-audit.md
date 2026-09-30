# My DEMEOS language release audit

Scope: AREA 1 Customer Experience only. This is a catalogue and implementation audit, not proof of live nine-language readiness.

## Current release gate

The customer controller exposes English, French and Arabic only. The six additional language catalogues now cover navigation, Discover, intention, confirmation, results, possibilities, no-match, save, status and feedback. The separate My DEMEOS page is not fully localized, so all six remain unavailable. Existing en/fr/ar My DEMEOS completeness also needs a separate audit: the page currently contains English-only text and does not have a complete private-page translation controller. Do not treat the coverage array alone as proof of a translated page.

## Private page inventory

The static HTML contains the customer navigation, authentication loading/signed-out/signed-in/unavailable states, relationship overview, five relationship areas, empty/loading/signed-out states, preference form, privacy explanations and control labels. The script `js/my-demeos.js` also generates dynamic strings for saved dates, removal, providers, historical product price and fulfilment, availability, feedback, loading, success, failure and verification states.

## Required invariants

- Preserve customer-entered intention, comments and preferences verbatim.
- Preserve business-provided names, descriptions, images, location, price and availability verbatim. Translate only customer-interface labels, not the historical business record.
- Preserve exact evidence meanings: Interested is not a purchase, booking or sale; saved possibility is not a conversion; feedback remains feedback.
- Keep historical price and availability clearly historical, never imply live availability.
- Never translate API keys, response values, identity verification or privacy-control payloads.
- Keep sign-in and sign-out behavior, permission checks and record deletion behavior unchanged.
- Translate all dynamic success, failure and unverified states, including when a save succeeded but a refresh failed.
- Audit RTL Arabic, mobile navigation and live language switching after wiring.

## Next implementation

Create a keyed static and dynamic My DEMEOS catalogue, connect it to the private page without translating record data, test all state paths and verify the page in all nine languages before expanding the selector. The existing three-language selector does not certify the private page.
