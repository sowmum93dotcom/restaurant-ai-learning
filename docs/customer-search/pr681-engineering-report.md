# PR #681 engineering handoff

## 1. Files inspected

Existing modules: `customer-learning-pipeline.js`, `customer-learning-evidence.js`, `customer-training-candidate.js`, `customer-candidate-promotion.js`, `customer-intelligence-interface.js`, `customer-intelligence-eval-set.js`, `customer-feedback-contract.js`, `customer-intention-contract.js`, `customer-understanding-context.js`, `customer-possibility-contract.js`, `customer-catalogue.js`, `customer-public-work-contract.js`, `customer-publication-rules.js`, `demeos-rules.js`, `demeos-customer-authentication.js`, `demeos-actor-context.js`, `demeos-authorization.js` and privacy/repository sections of `persistence.js`, under `api/_lib/`. Also inspected `api/customer/possibilities.js`, privacy configuration references in `api/public-config.js`, the actual locale registry `js/demeos-language-registry.js`, customer interface language code, existing learning/intelligence tests, eight browser gate scripts and both test workflows.

## 2. Architecture discovered

PR #681 was an open draft at `c820d08df00a9fdadde6f1b462af34f87163404f`, based on main `14c9db6fe82e427f991025374416f90299054eb5`. Its intelligence/learning modules were offline foundations without live HTTP integration. The established shared catalogue and deterministic Customer Experience remain authoritative. Guidance preferences are separate from learning consent. Original feedback-only evidence, training jobs and tiny judged cases did not yet provide multi-party adjudication, grouped splits or complete evaluation coverage.

## 3. Files created or changed

New modules under `api/_lib/`: `customer-evidence-provenance.js`, `customer-learning-labels.js`, `customer-training-dataset.js`, `customer-intelligence-runtime.js`, `customer-intelligence-evaluation.js`, `customer-offline-ranker.js`.

Extended existing modules: `customer-learning-evidence.js`, `customer-learning-pipeline.js`, `customer-training-candidate.js`, `customer-candidate-promotion.js`, `customer-intelligence-interface.js`, `customer-intelligence-eval-set.js`.

New tests: `test/customer-evidence-provenance.test.js`, `test/customer-learning-labels.test.js`, `test/customer-training-dataset.test.js`, `test/customer-intelligence-runtime.test.js`, `test/customer-intelligence-evaluation.test.js`, `test/customer-offline-ranker.test.js`, plus synthetic fixture `test/fixtures/customer-learning-fixture.cjs`. Extended existing intelligence-interface and candidate-promotion tests. The existing partial-success test for unknown provider IDs was strengthened to require full fallback.

Documentation: this report and `docs/customer-search/intelligence-architecture.md`. No Customer Experience UI, owner/admin code, authentication/payment flow or production route was changed.

## 4. Exact behaviour implemented

Strict, bounded, versioned offline multi-party evidence; purpose/trust/privacy/consent checks; provenance allowlists; deterministic conflict grouping; explicit adjudication before labels; reproducible grouped datasets; dataset-bound jobs; actual bounded offline logistic training; judged evaluation metrics/coverage; full provider fallback; default baseline, shadow visibility protection, artifact-bound candidate approval and rollback monitoring decisions. These are pure functions/contracts, not an enabled production intelligence service.

## 5. Evidence sources supported

Customer observations/explicit judgments/corrections, approved business information/claims/corrections, system execution/constraint/presentation/fact snapshots and verified outcomes. All remain evidence until controlled adjudication. Clicks and business self-claims cannot independently generate labels. Rejected IDs can carry optional deterministic reason codes; clarification decisions and source/version links can be supplied when available. No live source importer was added.

## 6. Privacy and trust protections

Explicit customer learning consent remains mandatory; guidance settings do not imply training permission. Policy hooks distinguish permitted purposes and reviewed consent applicability without legal assumptions. Unverified evidence is rejected; source verification is not truth. System evidence needs system-verified trust, labels need adjudicated decisions. Version 2 allowlists exclude raw request/contact/profile/payment/token objects. Opaque references require importer privacy review; parser format checks do not establish deidentification or authority. Legacy raw feedback jobs are inspection-only and cannot execute training.

## 7. Dataset and training implementation

Canonical SHA-256, source evidence/schema versions, label policy, explicit timestamp, purpose, counts and stable interaction split policy are bound into each dataset. Deterministic 80/10/10 hash buckets keep related evidence in one partition. Candidate jobs bind base, dataset version/fingerprint and purpose. A real three-feature logistic ranker runs offline with bounded iterations and held-out groups. Synthetic test experiment: 240 records → 60 adjudicated groups → 44 train, 8 validation, 8 test; 88 train examples. Validation/test MRR are 1 on deliberately separable synthetic fixtures. Dataset SHA-256: `e57fae6ad2e6d3a3901c7b9a6e5280744b06332ea996a410d005e8c3e315ce8b`. This demonstrates executable training, not production quality.

## 8. Evaluation implementation

Macro precision/recall, answerable-query MRR/binary NDCG, misleading rate, unsupported/no-result correctness, case-level hard-constraint/fact integrity and clarification accuracy. Safety checks examine all returned IDs/claims. Baseline/candidate reports must use the same judged-case fingerprint and cutoff; quality regressions cannot be hidden by looser thresholds. Hard-rule violations and invented structured facts fail. Coverage contract includes 23 areas and repository locales `en/es/fr/ar/pt/zh/hi/de/ja`. Nine multilingual synthetic smoke cases remain incomplete and require human language review; no multilingual quality claim is made.

## 9. Node tests and exact results

`npm test`: **1,225 passed, 0 failed, 0 skipped, 0 cancelled** on Node v24.19.0. Tests cover unverified rejection, provenance, approved business sources, claims/clicks, conflicts, controlled labels, PII allowlists, reproducibility/grouped splits, timeout/malformed/unknown-provider output, unchanged shadow results, artifact-bound approval, fact failures, multilingual coverage, rollback and actual offline training. Focused intelligence/evidence/training tests: **43 passed, 0 failed**. `git diff --check` passes.

## 10. Browser gate result

**All eight gates passed at 390px, 820px and 1440px:** public entry, context continuity, navigation/history, language, controlled media/continuation, search, preparation and payment status. Language-aware gates exercised all nine supported locales. Local gates used the unchanged existing scripts, a static server with route mocks, Playwright 1.62.1 and Chromium 153; these results are not live production verification. GitHub's existing browser workflow separately uses Node 22 and Playwright 1.55.0; remote CI status must be checked independently.

## 11. Risks and unresolved questions

No authenticated evidence importer, policy/legal decision service, actual retention/revocation enforcement, adjudication authority/storage, live snapshot version capture, production feature extractor, approved provider, signed artifact registry or deployment/rollback executor exists in this extension. Hashes bind content but do not authenticate decisions. Current split policy prevents interaction leakage, not all correlated business/customer leakage. Structured fact checks do not detect arbitrary prose hallucinations. Full independently judged multilingual/constraint datasets and real provider evaluation remain necessary. Offline operational metadata must stay private.

## 12. Working ML versus scaffolding

Working: deterministic offline logistic training, reproducible artifacts and held-out synthetic ranking evaluation. Architecture/scaffolding: multi-party import/approval contracts, broader trainable-purpose boundaries, provider/runtime modes and promotion/monitoring preparation. Absent: trained production search model, LLM fine-tuning, semantic retrieval training, production AI provider, real multilingual quality evidence and online/offline integration. All training artifacts prohibit production deployment.

## 13. Commit references

Inspected branch head: `c820d08df00a9fdadde6f1b462af34f87163404f`. The extension commit is recorded in the PR head and final engineering handoff; no merge commit is created.

## 14. PR safety and merge state

Changes remain on `area1-ai-search-learning-foundation` for main-agent review. PR #681 must remain draft, open and unmerged. No merge, production intelligence deployment, payment activation or customer architecture replacement is authorized or performed by this work. Safety assessment is limited to the reviewed code and observed tests, not a claim that unfinished integrations are production-ready.
