# AREA 1 — Development Management and Decision Log
Established 2026-09-29. Applies only to the DEMEOS Marketing Agent Customer Experience.

## Operating rule: one feature at a time
1. Read this log and the feature register **before** any new PR. Confirm main SHA and open PRs.
2. Select exactly one register ID and write its customer outcome, in-scope files, acceptance criteria, privacy/security boundaries and exclusions.
3. Review existing code and tests first; do not rebuild an implemented feature or open a cosmetic PR as a substitute for new capability.
4. Implement one complete, demonstrable vertical slice on a branch. Tests must cover the customer behavior and failure/permission boundaries, not just source text.
5. Review diff and run GitHub checks and Vercel preview. Do not merge failed, missing or unreviewed checks.
6. Merge only when green. Verify production deployment is READY at the **exact merge SHA** and aliases, then verify the actual customer path on phone/tablet where access is available. If device/account acceptance is not possible, mark **awaiting user acceptance**, not Verified.
7. Update the register and this log with PR, merge SHA, test result, deployment ID/state, observed outcome, limitations and next feature. Only then start the next item.
8. If a feature stalls, record blocker and decision; do not silently switch to unrelated work. No speculative production claims. No access to personal phone/tablet files.

## Change record template (append one row per feature, not one row per micro-PR)
| Date | ID | Customer outcome | PR / merge SHA | Tests | Production exact SHA and aliases | Actual journey/device acceptance | State / blocker | Next action |
|---|---|---|---|---|---|---|---|---|

## Baseline audit, 2026-09-29
Repository: sowmum93dotcom/restaurant-ai-learning.
- PR #562: optional session location controls. Merge SHA `599cf3a289e549aeaf4736b6f6c46595bd914f27`. GitHub V1 Baseline Tests success; Vercel preview success. Production deployment `dpl_Hw3tPfBwxDGmpf9aZdFKKiE3jfPo` READY with `www.demeos.io` and `demeos.io` aliases, confirmed in deployment metadata. No independently verified phone/tablet interaction. A1-13 therefore **Partial / awaiting journey acceptance**. Coordinates are not sent to recommendations; do not call A1-14 complete.
- PRs #524, #525 and #560: closed without merge on 2026-09-29 to stop repetitive Discover refinements.
- Existing three destinations and their associated APIs/components were inspected; the register uses **Implemented**, not **Verified**, where actual account/device acceptance is missing.
- README.md is outdated starter-project documentation; do not treat it as current feature truth. The register and actual code/PR/deployment evidence are the development source of truth.

## Active work queue
| Order | ID | Gate | State |
|---|---|---|---|
| 1 | A1-13 | Record real mobile/tablet location permission, denial and clearing acceptance | Awaiting acceptance; do not misstate completion |
| 2 | A1-14 | Verify optional exact business-listed place matching; GPS proximity remains separate | Merged PR #564; awaiting production/device acceptance |
| 3 | A1-22 | Full cross-destination production journey | Pending A1-14 |
| 4 | A1-20 | Define and implement genuine multilingual customer UI | Later; not started |

## Decision and cost controls
- Do not create PRs merely to increase PR count. A feature can require several commits, but it needs one tracked customer outcome.
- Do not activate payments, checkout or full DEMEOS economics in AREA 1.
- Do not call a merged PR or green preview production-complete.
- Do not start a new feature while the previous feature has an unrecorded result. An explicit hold with reason is allowed.
- User can request a different priority; record the change here before switching.

## 2026-09-29 — A1-14 implementation checkpoint
- PR #564: optional customer-provided town/city matches only the exact declared business location. Blank input retains existing recommendations. No GPS coordinates or inferred distance.
- First GitHub test run failed (place regex escaping and default response regression). Both corrected in the same PR; subsequent V1 Baseline Tests run #578 passed, Vercel preview succeeded.
- Merge SHA: `5df50ed19ac8562dceb08f202e30228d55a4c7b8`. Production deployment `dpl_9ahqCN4afvt62yP9wcAMR6ArjUnS` was BUILDING at first check; verify READY before marking production complete. Real mobile/tablet acceptance remains unverified.
- A1-14 remains Implemented / awaiting acceptance. Issue #561 automatic geolocation-based relevance is not complete; do not imply that it is.

## 2026-09-29 — A1-14 production checkpoint
- PR #565 documentation merged as `749cad7abfe62975967a8bf808e886aca853011e`; production READY.
- PR #566 corrected the exact-place result heading and distinguished manual place filtering from GPS permission. Its initial test failed because the previous copy assertion was stale; corrected on the same PR. GitHub V1 Baseline Tests run #581 and Vercel preview passed.
- PR #566 merge SHA `c4ebbdb9de4373e082ec5e9dfd9a27f4375d8965`; production deployment `dpl_AXzCdU8sSAXD183MbgbeipMRCiWr` READY, aliases www.demeos.io and demeos.io verified.
- Screenshot from iPhone showed Discover empty, not the I Know What I Want place flow. No customer device acceptance of place matching was established. Do not mark A1-14 Verified until actual place, blank fallback, no-match and tablet/mobile behavior are checked. Do not treat empty Discover as a location regression or add unapproved content.
