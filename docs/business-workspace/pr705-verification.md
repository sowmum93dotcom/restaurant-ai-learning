# Business approval and separate application access — PR #705

## Root cause and baseline

Baseline main/production is PR #704 merge e01593aabdd569d60602941f911ecd4156090383. The existing admin review endpoint accepted only `reviewed` and `changes-requested`, explicitly returned `approvalAvailable:false`, and never provisioned authoritative `businessProfile.applicationAccess` grants. The separate application access gateway correctly denied absent grants. Selecting Selling and saving/submitting onboarding are owner intent, not approval. The live account's exact approval record was not available for authenticated inspection.

Selling onboarding also required brand voice, target customers and a Marketing goal. Its Marketing context section appeared irrespective of the selected model. The preparation language label and selector lacked a reliable vertical layout on tablet.

## Repair

The existing trusted-admin API now accepts explicit Marketing, Selling or both scopes for approve, reject and revoke. Approval requires a complete current private submission requesting those applications; Marketing approval requires Marketing fields. Revocation remains available after a business edits its profile. Existing grants are independent and unselected grants are preserved. Owners cannot mutate grant/decision/revision fields; administrators cannot decide their own business.

The existing PostgreSQL review table is extended in place. Scoped decisions append the trusted administrator, original full revision/snapshot, selected applications, notes and resulting revision. Business row locks and one pinned transaction commit the grant plus audit together. Exact response-loss retries are idempotent; stale decisions cannot undo subsequent changes. Historical reviews and snapshots remain intact. The idempotent schema migration serializes its constraint upgrade with a transaction advisory lock. Existing ownership, authentication, media, catalogue and payment stores are retained.

The owner interface reports approval, rejection and revocation in all nine supported languages. Separate entry routing continues to use server authority. Returning to the app and a 30-second active-page check revalidate grants without discarding unsaved form fields; server APIs enforce revocation on every operation. Marketing and Selling navigation, dashboards and operations remain separate.

Selling onboarding hides Marketing-only questions and their step link, and both client/server validation accepts Selling submissions without those answers. Business identity, category, contact routes, operational availability and fulfilment remain required. Marketing and dual journeys retain Marketing requirements. The language label and select have separate rows and bounded widths.

## Verification

- Complete Node suite; approval lifecycle, owner/self-approval denial, malformed scopes, stale revisions, concurrent retry, historical schema upgrade and owner-write protection use real disposable PostgreSQL via PGlite.
- New required `business-approval-journey-gate.js` tests registration → model selection → private submission → actual admin browser approval → authoritative grants → correct separate application → revocation at 390, 820 and 1440 pixels for Marketing-only, Selling-only and both.
- New journey checks rejection, open-tab revocation, Marketing/Selling access isolation, owner admin denial, nine languages, no horizontal overflow and non-overlapping language controls. Screenshot evidence is retained by the existing GitHub browser workflow artifact (`demeos-approval-*`).
- Existing owner, Selling inventory and private admin browser gates verify products, media, options/variants, inventory, private orders, revision history and authentication removal. The unchanged complete browser workflow remains required before release.
- Exact-head GitHub CI, native independent Codex review and Vercel preview verification must pass before merge; their final evidence is recorded in the PR conversation.

## Limits and production safety

All authenticated journeys use isolated identity-provider adapters, actual application APIs and disposable PostgreSQL, not real production accounts or records. Authenticated production owner/admin credentials were not available. No real business was automatically approved or populated. An authorised administrator must explicitly approve each actual business in the deployed Admin application. Physical Safari/iPhone video playback and live production storage acceptance are not claimed. Local browser codec fallback is accurately reported; GitHub Chrome retains existing media playback gates.

Live customer ordering, payment activation and publication remain disabled. No Customer Experience feature or payment architecture changes are part of this repair. Production release uses the existing Vercel Git pipeline, with exact merge commit and READY state checked after merge.
