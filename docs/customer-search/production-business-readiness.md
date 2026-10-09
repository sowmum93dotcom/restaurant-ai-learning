# Production business readiness — PR 691

## Baseline and observed production evidence

PR 690 merge `69197aca56d003bab79eb632995f2bccf5d45d0a` was verified production READY on `www.demeos.io` before this work. On 2026-10-09, the existing public `GET /api/customer/work` returned HTTP 200, `Cache-Control: private, no-store`, and `{"work":[],"testMode":false,"customerPackages":[]}`. The existing owner-only `GET /api/businesses` returned HTTP 401 with `Authentication required.` to an anonymous request.

These observations establish an empty public catalogue, **not** an empty private database. No authorized production database session or business-owner session was available for inspecting private rows. We have not certified any production business, offer, approval or media asset as genuine. No production records were created, edited, approved or published. The public empty state remains accurate.

The stronger baseline browser check found `testMode:true` on normal search requests even though the unopted public API was empty. The UI supplies controlled-preview headers by design, and the deployment lacked the existing disable setting. For this release, `DEMEOS_CONTROLLED_TEST_CONTENT=disabled` was added to this project's Production and Preview targets. This is a nonsecret existing switch; it takes effect in new deployments, without changing the controlled fixtures, authentication or publication architecture. Preview and final production browser checks must confirm `testMode` is absent from normal empty search responses. The isolated engineering continuation gates keep their own opt-in fixtures independent of deployed settings.

The story under verification is customer request → confirmed understanding → the existing joined business/campaign catalogue → deterministic eligibility and ranking → results → the existing Product Experience and product/service continuation. There is no additional catalogue, search engine, approval route or public audit endpoint.

## Exact prerequisites in the existing system

| Boundary | Required authoritative evidence and behavior |
| --- | --- |
| Genuine ownership | An actual business supplied through existing authorized owner flows, with `demeos_business_owners.trusted_identity_id` linked to the same `business_id`. The customer catalogue joins database business/campaign keys; it does not authenticate the person behind a stored name or prove commercial authenticity. An authorized operator must establish this provenance. |
| Business identity | `demeos_businesses.profile` is an object with a nonblank `name`. If embedded `profile.businessId` exists, it must equal the database key. `profileVersion >= 2` enables continuation/fulfilment, `>= 3` operating availability, and `>= 4` offers. Missing optional metadata is not invented. |
| Approval and publication | A joined `demeos_campaigns` row belonging to that business, with `campaign.approvalStatus === 'Approved'`, supported `campaignType` (`social`, `email`, `full`), and nonempty customer-facing content. Embedded campaign IDs, if present, must match database keys. `full` requires all five ordered sections with content; only the existing public social/ad/call-to-action sections are exposed. The existing capability must be available. Approval must come through the existing authorized lifecycle. |
| Provenance and freshness | If `informationStatus` exists it must be an object with `status: 'business-provided'`; a supplied `source` must be `business-owner` and `ownerConfirmedAt` must be a valid nonblank date. Absent optional provenance, location or timestamps yields unverified diagnostics, not fabricated verification. `approved_at` is historical initial approval; later `updated_at` does not prove effective reapproval or freshness. |
| Exact product/service | A v4 `products` array. Each public offer needs a unique trimmed `productId`, matching `businessId`, nonblank `name` and `description`, visibility other than `false`, and a usable declared `continuationRoute`. Duplicate offer IDs reject all occurrences. Rejected declared offers must not be replaced by generic campaign text. Services use the same owned offer contract. |
| Continuation | The offer's route must survive `customerContinuation.routes` validation. Website/booking details use HTTP(S), email uses a valid address, phone/WhatsApp uses the existing digit rules, visit requires an address, and quote requires a usable contact fallback. Existing DEMEOS preparation/payment eligibility still governs DEMEOS routes. The receiver must retain the exact offer, variant/options, business name and destination. Do not follow a final external purchase/booking action during verification. |
| Categories and relevance | Existing category classification is validated against the same offer's name/description and the existing dataset version/registry. Missing classification is not manufactured. Only confirmed understanding and supported same-offer facts may establish relevance; exclusions, location and monetary constraints can remove otherwise published records. |
| Price and availability | Preserve the owner's price and existing presentation pricing/options/variants. Unknown price becomes contact pricing; unknown availability becomes contact, never available. Unavailable offers cannot become available search results or actionable continuations. Hard budget requirements require supported compatible monetary facts. Business location/availability remains supplied evidence, not geolocation or inventory verification. |
| Media relationships | Campaign links must resolve to the same business's ready media assets and valid primary/supporting roles. Managed storage/derivatives must remain in the same business/asset namespace, with valid HTTPS delivery. Product/service relationships only survive if the exact linked public offer survives projection; otherwise media stays view-only. Private storage keys and rejected offers never become public data. |
| Controlled content | Reserved controlled identity namespaces and controlled product-image paths are rejected by publication inspection. Engineering fixtures are isolated in PGlite memory. Opt-in examples require both the existing explicit header and query; query alone never supplies genuine results. The existing UI sends this opt-in pair on its normal search/Discover requests, so genuine-only production must use the existing `DEMEOS_CONTROLLED_TEST_CONTENT=disabled` setting. Verify its effect through the actual browser response, without retrieving or logging environment secrets. Never load fixtures into a deployed database to satisfy readiness. |

An authorized operator can inspect the existing tables without exposing row content or changing publication. This read-only aggregate is a starting point, not an eligibility or authenticity certificate:

```sql
SELECT
  (SELECT COUNT(*) FROM demeos_businesses) AS business_rows,
  (SELECT COUNT(*) FROM demeos_businesses b WHERE EXISTS (
    SELECT 1 FROM demeos_business_owners o WHERE o.business_id = b.business_id
  )) AS business_rows_with_owner_link,
  (SELECT COUNT(*) FROM demeos_campaigns) AS campaign_rows,
  (SELECT COUNT(*) FROM demeos_campaigns c JOIN demeos_businesses b
    ON b.business_id = c.business_id
    WHERE c.campaign->>'approvalStatus' = 'Approved') AS joined_approved_rows;
```

Then inspect the relevant owned profile, campaign lifecycle and media through existing authorized tools, apply `inspectCustomerPublication` and the existing repository/public projection, and check an actual matching request. Aggregate counts alone cannot prove that a published offer is complete, genuine, eligible, within the retrieval window or fresh. Retrieval diagnostics contain fixed reason/count aggregates and cover inspected candidates only; they are not a full database audit. Do not expose private profile JSON, identity IDs, tokens, storage keys or diagnostic details to customers.

## Verification and limits

The required approved-source browser gate now verifies an **actual empty SQL catalogue** through real HTTP handlers and the unchanged UI across all nine interface locales (`en`, `es`, `fr`, `ar`, `pt`, `zh`, `hi`, `de`, `ja`) at widths 390, 820 and 1440. It checks request → understanding confirmation → HTTP 200 empty response → visible empty state, Arabic RTL, no result cards, no horizontal overflow and no page errors. API checks cover invalid understanding (400), private/no-store responses and query-only controlled-mode isolation. Existing isolated SQL fixtures separately verify later-page exact product/service continuation; those results are engineering evidence, never claims about production businesses.

`browser-checks/customer-live-readiness.js` repeats the public empty-state checks against an explicitly supplied HTTPS deployment origin. It accepts JSON on stdin with `url` and `expectEmpty:true`, plus an optional short-lived Vercel share for protected previews. It makes public GET/POST searches only, does not log configuration/share secrets, and has no database client or fixture loader. It fails on HTTP errors or any nonempty catalogue rather than misreporting them as an empty state. Example for unprotected production:

```sh
printf '%s' '{"url":"https://www.demeos.io","expectEmpty":true}' | node browser-checks/customer-live-readiness.js
```

Language tests preserve the interface and locale routing. Their English request is deliberately constant; they do **not** certify nine-language semantic recall against real businesses. No such claim is possible while there are no verified genuine public offers for this journey.

Existing pagination remains bounded at 200 projected search candidates, at most 1000 source rows, pages of 50, and five final results. Discover retains 20 records. Existing tests cover those bounds, invalid history, exclusions, privacy and deterministic fallback. OFFSET pagination is not a transactional snapshot; concurrent updates can move rows, and matching records beyond the bounded window can be absent. Local/CI timing and a production smoke are regression evidence, not a database-scale latency or load-test guarantee.

The frozen server configuration remains `baseline`, with understanding/category providers, ranking provider, artifact and evidence all null. External semantic AI remains disabled. Payment, authentication, Business Owner Workspace, Admin Panel and DEMEOS economic architecture are unchanged. Completion is PR 691 merged, GitHub checks successful, preview verified and the exact merge commit production READY; no PR 692 work is included.
