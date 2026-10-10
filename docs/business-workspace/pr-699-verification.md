# PR 699: visible business workflows

## Verified starting point and cause

Main and PR 698 merge are `6fd8ddb81038c410f563a44ead7891c02f44d2d1`. Production deployment `dpl_FancoPXFX5vqDARgE1XW9ebT4VS6` was READY for that commit and served www.demeos.io. Its deployed business-workspace.js matched main exactly.

The real owner renderer created only one model card. With both preparation permissions it defaulted to Marketing and hid Selling behind a small view switch. The later stylesheet overrode the original two-column layout to `display:block`. On phones the model section followed business identity and next action. Missing permissions removed both descriptions entirely. This was a presentation problem, not a missing commercial model.

## Focused changes

Both existing workflows now have simultaneously visible, labelled cards immediately after the welcome heading, before business identity/activity. Marketing explains approved direct business continuation; Selling explains the existing DEMEOS purchase journey and separate selling/payment authorisation. Each permitted preparation action links to its existing authenticated Marketing or Products page. The five workspace areas and owned-business context remain intact.

Both explanations remain visible when permissions cannot be confirmed, with explicit unavailable/not-authorised status and no preparation action. Only exact matching business readiness and boolean true enable preparation links. Explicit missing readiness also prevents the Overview from suggesting a confirmed preparation action. Choosing an action never writes commercial permissions. Existing prices, contracts, catalogue, publication, authentication, payments, administrative review and external AI configuration are unchanged.

The navy/gold cards stack on phones and sit together on tablet/desktop; article headings, readable permission status, 44px actions and visible keyboard focus support accessibility. Existing nine-language customer and onboarding infrastructure is preserved; this focused owner Overview remains English, as before.

## Verification and rendered evidence

The extended existing owner browser gate uses real isolated PostgreSQL/PGlite, owner APIs and authoritative records, with a test-only identity-provider adapter. At 390, 820 and 1440px it reloads the authenticated workspace using isolated readiness response fixtures for marketing only, selling preparation, both, denied preparation, missing readiness, malformed booleans, foreign business identity and confirmed selling permission presentation. No fixture grants actual server purchase permission or persists permission changes.

Each state verifies two rendered cards, exact permitted links, unavailable next action, readable continuation/authorisation explanation and no horizontal overflow. Both workflow actions traverse the actual existing pages, preserve the exact business ID and correct active navigation, then return to Overview. Existing category/options/variants/media/factual draft/private submission/Results/sign-out and nine-language onboarding tests continue. Cross-business reads/writes and media/draft associations remain rejected. Signed-out workspace stays hidden and the real owner API returns 401. Real selling readiness remains false and controlled content never becomes public.

Screenshot evidence is retained by the required GitHub Customer Experience Browser Gate in its `customer-experience-review` artifact:

- `demeos-owner-models-both-{390,820,1440}.png`: both workflow presentations.
- `demeos-owner-models-{marketing-only,selling-preparation,unavailable,missing,malformed,foreign,selling-confirmed}-{390,820,1440}.png`: isolated permission states.
- `demeos-owner-models-unauthorised-{390,820,1440}.png`: signed-out boundaries.
- `demeos-owner-overview-{390,820,1440}.png`: complete authenticated Overview.

Local original-video playback uses the existing truthful codec fallback where H264 is unavailable. Required GitHub Chrome tests verify supported original video playback.

## Release requirements and remaining limits

Required exact-final-head V1 Baseline Tests and Customer Experience Browser Gate, independent Codex review, READY exact-head preview and safe deployment verification must pass before merge. After merge, verify exact production commit READY and www.demeos.io alias, owner authentication/private API boundaries and nine-language read-only Customer Experience regression checks. Final hashes, workflow runs, review outcome and deployment IDs are recorded in the PR release report.

Production checks do not create businesses, applications, drafts, approvals or payments. Genuine authenticated owner usability is not claimed from isolated identity tests or signed-out production checks. Preparation permission is distinct from publication, business approval, selling and merchant payment authorisation; those remain subject to the existing separate authority. No external AI or public onboarding is activated. Work stops after PR 699.
