# Approved business data readiness audit

Starting main: `64c0fa6ab3d9711be07b83b64063c9c5bfa32830`. PR 688's production deployment was verified READY before development.

One authoritative path remains: joined `demeos_campaigns` and `demeos_businesses` records → existing campaign publication rules → owned public profile offers → approved media resolver → shared public catalogue projection → controlled category narrowing → deterministic eligibility → guarded ranking → existing Customer Experience receiver.

| Fact | Existing authority |
| --- | --- |
| Business and campaign identity | Database join keys, not embedded JSON claims |
| Publication and public campaign content | Existing approved campaign and supported capability rules |
| Business name, location, continuation and operating information | Business profile saved through existing owner authorization |
| Offer identity, price, options, availability and visibility | Same owner's profile products and existing public/item contracts |
| Media identity, ownership, readiness and delivery | Existing media records and approved campaign links/storage resolver |
| Controlled categories | Existing 171-category registry and same-offer guarded validation |

Findings before implementation:

1. Embedded profile/campaign identity claims can disagree with authoritative database keys without an explicit catalogue rejection.
2. Optional information provenance can contradict the existing business-provided state without a rejection.
3. Approved media can retain a product relationship to an absent, hidden or rejected offer. It must remain view-only, with the invalid continuation relationship removed.
4. Rejected or inconsistent records currently have no bounded, content-free readiness diagnostics at catalogue selection. Every fetched approved row reaches the existing publication validator, including fetched rows after the 20-result response cap. Original type/content candidate retrieval is preserved, augmented by at most 50 newest invalid approved publications selected in SQL for diagnostics. This bounds additional pagination caused by invalid publication history while allowing valid offers beyond the sample to be retrieved. These are retrieval-scoped diagnostics: older pages beyond the filled catalogue are not queried and media/offer diagnostics cover projected records. Counts describe inspected records, not total database defects. This is not a whole-database audit on each customer request.
5. Database `approved_at` records initial approval and survives withdrawal/reactivation; `updated_at` also advances for legitimate outcome and lifecycle updates. These timestamps cannot establish the effective current approval time or expiry. When updates follow initial approval, report freshness as unverified without claiming an unreviewed publication change, inventing an expiry policy, or changing historical approval evidence. Missing metadata is likewise freshness-unverified; current publication eligibility remains governed by the existing approval status.

Implementation will extend existing publication/projection/repository modules. Diagnostics will contain fixed reason codes and aggregate counts only, never identifiers, text, contact details, prices or media URLs. No new database, approval system, customer interface or external service is required. Engineering fixtures are separate from genuine production validation.

Compatibility: absent optional legacy provenance/location/freshness metadata is reported as unverified, never fabricated as owner confirmation or freshness. Explicit contradictory provenance or embedded identity rejects the row. Invalid offer links are removed in the authoritative repository projection; intentionally unmatched controlled test scenarios retain their existing receiving safeguards. Exact unavailable offer identity is retained while existing eligibility/continuation controls prevent its use as an available offer. No age-based expiry or new approval policy is introduced.
