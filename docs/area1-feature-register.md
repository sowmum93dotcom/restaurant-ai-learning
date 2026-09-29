# AREA 1 Customer Experience — Feature Register
Version: 2026-09-29. Source: main after PR #562, merge 599cf3a289e549aeaf4736b6f6c46595bd914f27.
Scope: Discover, I Know What I Want, My DEMEOS only. This is the Marketing Agent, not the full DEMEOS economic system.

## Status definitions
- Implemented: identifiable code and/or tests exist; **not** proof of production user acceptance.
- Verified: automated checks, production exact commit and real customer journey/device acceptance are recorded in the management log.
- Partial: visible implementation exists but the end-to-end capability is incomplete.
- Planned: no complete implementation established.
- Blocked: requires an explicit decision, evidence or dependency.
No item may be marked Verified from a merged PR alone. Existing implementation does not imply that it works for every account or device.

| ID | Area | Feature and expected customer outcome | Evidence in repository | Current status | Next verification or work |
|---|---|---|---|---|---|
| A1-01 | Entry | Public Customer Experience and three clear destinations | customer.html, my-demeos.html, js/customer-navigation.js | Implemented | Verify production routing on phone and tablet |
| A1-02 | Discover | Approved business feed and honest empty/error states | api/customer/work.js, js/customer.js, customer.html | Implemented | Check real approved and empty feed; retry |
| A1-03 | Discover | Business identity, approved media, product/service options | js/customer.js, customer.html, Discover tests | Implemented | Real device visual and data integrity check |
| A1-04 | Discover | Up/down business, left/right media, video lifecycle | js/customer.js, Discover gallery tests | Implemented | Check actual touch/navigation behavior |
| A1-05 | Discover | Controlled, labelled test content isolated from normal feed | js/customer.js, api/customer/work.js, Discover tests | Implemented | Verify test flag and normal public isolation |
| A1-06 | Discover | Matched approved product continuation; unmatched media view-only | js/customer.js, js/customer-continuation.js, continuation tests | Implemented | Verify valid and invalid media/product journeys |
| A1-07 | Discover | Product availability and external marketing continuation without invented checkout | js/customer.js, api/_lib/customer-public-work-contract.js, continuation tests | Implemented | Check unavailable product and actual business links |
| A1-08 | Intention | Select intention or describe need in own words | customer.html, js/customer.js, js/customer-understanding.js | Implemented | Complete mobile form journey |
| A1-09 | Intention | Clarify, confirm or change understanding | js/customer.js, api/_lib/customer-understanding-context.js | Implemented | Verify clarification and correction cases |
| A1-10 | Intention | Evidence-based possibilities and honest no-match outcome | api/customer/possibilities.js, api/_lib/customer-possibility-contract.js, js/customer.js | Implemented | Test representative global categories, exclusions and no-match |
| A1-11 | Intention | Explore possibility, relevant products and validated actions | js/customer.js, possibility/continuation tests | Implemented | Verify complete real customer journey |
| A1-12 | Intention | Save intention and possibility to private account | js/customer.js, js/my-demeos.js, saved-intention/possibility tests | Implemented | Verify signed-in/out behavior and persistence |
| A1-13 | Intention | Optional location permission, clear session state, denial fallback | PR #562; js/customer.js, customer.html, test/customer-location-session-control.test.js | Partial | Production controls deployed; location not used in recommendations |
| A1-14 | Intention | Validated opt-in location-aware possibilities, no invented proximity | Issue #561; no location input in current possibilities request | Planned | Design and implement one complete privacy-preserving feature |
| A1-15 | My DEMEOS | Single customer authentication, sign in/out and protected private data | my-demeos.html, js/my-demeos.js, authentication tests | Implemented | Verify real production sign-in/out on phone/tablet |
| A1-16 | My DEMEOS | View/remove saved intentions | js/my-demeos.js, customer intentions tests | Implemented | Test actual account persistence |
| A1-17 | My DEMEOS | View/remove saved possibilities and product details | js/my-demeos.js, saved possibilities tests | Implemented | Test actual account persistence |
| A1-18 | My DEMEOS | Participation history and business relationship dashboard | js/my-demeos.js, participation tests | Implemented | Verify real history and empty state |
| A1-19 | My DEMEOS | Preferences and explicit feedback guidance controls | js/my-demeos.js, privacy/preferences tests | Implemented | Verify toggles, saving and retrieval |
| A1-20 | Cross-area | Global language handling and responsive phone/tablet design | js/customer.js, customer-global-language.test.js, CSS | Partial | Preferred-language detection exists; full translated customer UI not established |
| A1-21 | Cross-area | Safe data, permission and identity boundaries | customer API contracts and security tests | Implemented | Regression check against actual routes |
| A1-22 | Cross-area | Real customer journey acceptance from public Discover through private saved result | customer.html, my-demeos.html, multiple integration tests | Partial | Record an end-to-end production acceptance run |
| A1-23 | Commercial boundary | Future checkout readiness only; no unapproved live payment | docs/customer-commercial-continuation-contract.md, docs/customer-payment-provider-acceptance-gates.md | Blocked | Do not activate payment without separate instruction and acceptance gates |

## Priority
1. Close and verify A1-13 as the already merged feature. The controls are deployed, but the location-based recommendation feature is not.
2. Develop A1-14 as the next **new feature** only after a bounded privacy/data contract is approved. Do not represent coordinates as verified business proximity.
3. Run A1-22 end-to-end acceptance; then address only evidenced defects.
4. Review A1-20 global language capability as a separate new feature after A1-14 is complete.
No gallery polish, Business Owner Workspace, Admin Panel or economic architecture changes under this register.
