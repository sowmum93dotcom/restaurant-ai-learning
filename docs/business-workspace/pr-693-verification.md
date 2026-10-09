# PR 693 implementation and release checklist

The existing owner workspace is retained: business-workspace.html, marketing.html, business-results.html, their Clerk boundary, owner authorization, profile/campaign/media tables and APIs. No replacement dashboard, catalogue, customer engine or payment/authentication architecture is introduced.

## Inspected existing functionality

Profiles already support business identity, owner confirmation, product/service descriptions, direct continuation routes, prices, availability, fulfilment and structured product options. The media library already has storage sessions, processing and exact related-entity metadata. Campaign generation/revision, owner approval, withdrawal/reactivation, outcomes, recommendations, Interested actions and relevance feedback already exist. The existing generator has an external writing-provider path; this release does not configure or activate it. Customer semantic AI remains disabled.

## Implemented

Five primary areas: Overview, My Business, Products and Services, Marketing, Results. Products/media reuse the existing fields once in a dedicated panel; review/save still uses the existing profile contract. Hash navigation retains the selected area. Overview uses the authorized server record for identity and activity rather than presenting cached browser claims as confirmed current data.

The authorized business GET response presents both models. Marketing prepares offers for approved direct destinations. DEMEOS selling permits owner product preparation but remains unavailable for live sales: the existing checkout has no genuine merchant quote loader/provider configured. Neither an owner profile flag nor a visual model choice creates selling permission. The existing checkoutReadiness predicate, purchase selection and payment service remain unchanged.

Factual draft preparation is a mode of the existing generate API. It uses only the saved, owned product, price/availability and business facts, with optional ready owned media whose exact related product/service matches. No external model or image generation is used. Owners edit the draft through the existing campaign persistence route and submit for review using its existing lifecycle route. Prepared drafts stay Unapproved and private. Owners cannot strip the persisted preparation marker, approve or reactivate these drafts. Exact campaign lookup avoids the 20-record dashboard window; database writes preserve the private marker atomically and reject approval, including stale writes. Public projection also rejects prepared drafts even if an invalid Approved flag exists. Editing resets submission. No Admin Panel/control is built or modified; administrative acceptance/publication of this new draft type remains unavailable until that system is completed. Existing legacy campaign approval/publication behavior is preserved.

Media registration previously contained literal escaped newlines and incorrect relative imports, so the actual route could not load. Both are corrected. Exact product/service relationships are now validated against owned saved offers before registration. New upload guidance can attach media to an owned saved offer. Existing storage/processor contracts remain authoritative; no processing/ready self-promotion is added.

Product editing preserves existing structured presentation/category/options/variants and exact product IDs. The simple editor does not silently rewrite structured pricing; price changes needing option management are blocked with guidance. Media hydration discards delayed results after a business switch; upload completion retains the original business ID.

Results show recorded Interested actions separately from product impressions, product views, contact/external actions and verified purchases. Unimplemented metrics say Not recorded, never fabricated zero/revenue/conversion. Data is from the existing owner-scoped response for at most 20 recent campaigns. No individual customer identifiers are returned. Owner responses use private/no-store. Results load after authorized owner context is ready.

## Verification

- Node baseline plus factual draft, missing facts, exact media/ownership, model spoofing and unavailable analytics tests.
- Browser → real owner HTTP handlers → existing repository → isolated PGlite: three viewports (390/820/1440). Owner A cannot access/generate Owner B, unrelated media rejected, exact structured product retained on edit/save, matching owned media retained through factual draft/edit/private submission, owner approval/reactivation denied, public feed remains empty, results distinguish unavailable metrics and sign-out hides private content.
- Existing Customer Experience/browser/language, database, purchase/payment/authentication, publication and search regression gates remain required.
- Exact-head GitHub required workflows and protected Vercel preview must pass before merge. Verify the exact merge deployment READY and live anonymous owner gates after merge.

All engineering data stays in the in-process isolated database and provider adapter. No genuine businesses, publication rows, customer accounts, live payments, external AI configuration or public onboarding invitations are created in deployed environments.

## Remaining requirements

Live merchant/product purchase authorization and real payment acceptance are not activated. Structured category/option/variant authoring beyond the existing simple editor needs further owner tooling. Administrative review/publication for prepared drafts is intentionally pending. Automated image improvement/generation is not operational; existing supplied originals remain unchanged. Product-level impressions/views/contact actions/verified purchase reporting need trusted event sources, consent/retention and integration before metrics can be reported. Real owner-provider login and production account/data-write round trips need authorized real accounts; isolated adapter/browser and actual server authorization tests do not certify those provider round trips. Existing owner UI is English; nine-language Customer Experience contracts are preserved, but owner workspace translation remains future work. Public business onboarding remains unenabled.

Stop after PR 693 deployment verification. Do not start PR 694.
