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
| 2 | A1-14 | Validated privacy-first location-aware recommendations, no invented distance | Next new feature; issue #561 |
| 3 | A1-22 | Full cross-destination production journey | Pending A1-14 |
| 4 | A1-20 | Define and implement genuine multilingual customer UI | Later; not started |

## Decision and cost controls
- Do not create PRs merely to increase PR count. A feature can require several commits, but it needs one tracked customer outcome.
- Do not activate payments, checkout or full DEMEOS economics in AREA 1.
- Do not call a merged PR or green preview production-complete.
- Do not start a new feature while the previous feature has an unrecorded result. An explicit hold with reason is allowed.
- User can request a different priority; record the change here before switching.
