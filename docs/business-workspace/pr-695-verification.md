# PR #695 — Professional Business Owner Workspace

Baseline: latest main verified as `f9f8557fd232fdb93b36a67b8d8bd310a4138afc` (PR #694). No new catalogue, payment system, permission system, external AI, public onboarding or Admin functionality is introduced.

## Implemented

- Preserve the five primary owner areas. Remove duplicate Overview, Business Profile and Results controls from the Marketing subnavigation; keep four focused marketing tools. Hide that subnavigation while editing business information or products.
- Navy and gold Overview now shows saved business information, approval boundary, a next action, recent private/submitted work and recorded activity. Remove duplicate exploration/public-entry cards; retain one separate Customer Experience destination.
- Show only preparation workflows confirmed by the private server response for the exact business. Marketing explains the £149 monthly service and approved external purchase/booking/enquiry destinations. Selling explains the shared product catalogue and existing server purchase controls. A two-workflow view switch is presentation only and performs no permission or purchase mutation.
- Existing server readiness grants both preparation workflows and explicitly denies selling. Therefore real deployments show selling preparation only. A confirmed selling permission presentation is covered using isolated readiness snapshots; no live selling grant is invented or activated.
- Three guided stages: offer and media; prepare and edit; submit for review. Preserve exact products, option values, variant identifiers, prices and matching original image/video relationships. Simplify owner-facing combination labels without changing the authoritative category/attribute contracts.
- Move the existing preparation language selector into the shared marketing preparation area. Add the three stage labels to its existing nine-language contract and existing preference. Saved business facts remain in their original language; full legacy workspace localization remains future work.
- Reuse recorded Interested activity for the Overview summary. Missing feeds display unavailable rather than zero. Unrecorded product impressions/views, external continuation and verified purchases remain explicitly unavailable. Counts describe the bounded recent campaign feed and never imply unique visitors, conversions or revenue.
- Discard late Overview responses for a previously selected business. Clear stale results cards on a failed private read.

## Verification and release conditions

The owner browser gate runs the actual APIs and PostgreSQL-compatible repository in isolated PGlite, with an engineering identity-provider adapter. It exercises 390, 820 and 1440 pixels; marketing-only, selling-only, dual preparation, missing and malformed readiness; real server denial of selling; product/service authoring and exact identity preservation; original media; private factual draft editing and submission; nine-language guidance and Arabic direction; results; ownership isolation; publication rejection and sign-out. Presentation snapshots do not substitute for real server authorization.

Screenshots: `/tmp/demeos-owner-{overview,product-editor,draft,results}-{390,820,1440}.png`, uploaded by the existing GitHub browser workflow. These depict isolated engineering businesses, not genuine signed-in production owners.

Local Chromium verifies original video identity, inline controls and a truthful unsupported-codec fallback. Required release CI uses Google Chrome and asserts supported original H264 playback and advancing video time; local fallback is not sufficient release evidence.

Required before merge: complete Node suite; exact final head success for Node Tests and Customer Experience Browser Gate (including owner SQL/API/security and original video playback plus customer search, privacy, languages, media, registration and payment gates); rendered interface review; no unresolved genuine review findings; Vercel preview READY.

Required after merge: Vercel production READY for exact merge SHA; read-only live owner authentication boundaries and Customer Experience at the supported widths. No genuine account creation, production test data, publication or payment activation. Real owner sign-in is not claimed where preview authentication configuration is unavailable.

## Remaining requirements

Administrative publication review for preparation-only drafts, genuine merchant/selling activation under existing authorization, external continuation and verified sales reporting, full workspace localization, and genuine approved-business usability validation require separate future work. This PR does not claim those capabilities are complete. Stop after PR #695.
