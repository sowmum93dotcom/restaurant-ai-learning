# DEMEOS search intelligence and controlled offline learning

Status: PR #681 engineering extension, 7 October 2026. The new runtime and learning modules are **not integrated into the customer HTTP path**. No production provider, model, training collection, promotion or deployment is enabled by this change.

## Existing online authority

Discover and I Know What I Want share the existing approved DEMEOS catalogue selection foundation. `api/customer/possibilities.js` retains deterministic request interpretation, catalogue retrieval, publication/identity checks, relevance and constraint filtering, repository-backed issued possibilities and existing customer guidance. Product, Buy, authentication, My DEMEOS, nine-language presentation and controlled test separation remain unchanged.

The intended online order remains request → understanding → shared catalogue retrieval → deterministic eligibility and hard constraints → optional validated intelligence ranking → useful clarification/results → existing customer actions. Learning does not run here. Search intelligence may never grant publication, availability, identity, privacy, payment or test-data eligibility. The intelligence boundary assumes its caller has already obtained eligible possibilities from those existing contracts; it is not another eligibility implementation.

## Evidence from multiple parties

`customer-evidence-provenance.js` accepts version 2 offline evidence envelopes. `evidenceFromParty` exposes this contract through the existing evidence module. The importer must authenticate sources and obtain policy/verification decisions before invoking these pure functions. An asserted `Approved`, consent or verification flag is a contract field, not independent authentication or proof.

| Source | Supported signals | What it establishes |
| --- | --- | --- |
| Customer | request, explicit relevance/non-relevance, clarification, selection, save, continuation, correction | A permitted observation or claim, not automatic ground truth |
| Business | published information, catalogue correction, relevance claim, outcome confirmation | Approved-source information; promotional relevance claims still need validation |
| System | search execution, constraint evaluation, presentation, fact integrity | A verified snapshot of eligible/rejected/presented IDs and integrity checks |
| Outcome | verified outcome, mismatch, resolved search, confirmed correction | Verified outcome evidence requiring scoped interpretation/adjudication |

All accepted records carry schema/evidence versions, opaque evidence and search references, request reference, catalogue/intelligence versions, signal, assessment, verification state/method/reference/trust, purpose, locale, timestamp, allowed purposes, privacy/retention classes, related result IDs and provenance links. Evaluation, source, business-data, interpretation and ranking references are optional integration fields. Do not fabricate unavailable production version identifiers. Actual live capture of these snapshots and versions is future work.

System snapshots contain eligible, rejected and presented IDs, constraint/fact-integrity checks and optional bounded numeric feature rows. Presented IDs must be eligible and eligible/rejected sets must not overlap. Optional rejection reason codes and a clarification decision can be supplied when available; this revision does not fabricate or capture them from live execution. Richer business/product relationships need a separately reviewed integration.

## Privacy and trust policy

The existing customer feedback/privacy routes are unchanged. `usePreferencesAsGuidance` and `useFeedbackAsGuidance` do not grant training permission. Explicit `learningConsent` and verified evidence remain required. Customer and deidentified evidence cannot waive this consent through the new policy hook.

Purpose-scoped permission decisions support relevance ranking, query understanding, attribute extraction, semantic retrieval, clarification, operational metrics, aggregate evaluation and personalized learning. Public-business/system evidence can only use `policy-reviewed-not-applicable` when a trusted policy decision explicitly provides it. This is an integration hook, not a legal conclusion. A future policy service must determine lawful purposes, scope, revocation and retention before collection. Aggregate-only retention cannot authorize training.

Trust vocabulary is confined to the new evidence contract: unverified, verified-source, cross-validated, system-verified, adjudicated. Unverified evidence is rejected; callers can demand a stronger minimum trust for a purpose. System snapshots additionally require system-verified trust. Source verification does not validate the semantic truth of a relevance claim.

Exports use explicit allowlists: no raw query, name, email, private profile, payment information, token, account object or arbitrary business text enters version 2 evidence/labels/datasets. Request references and source links must be genuinely opaque identifiers supplied by a privacy-reviewed importer. A bounded identifier format cannot prove that an identifier contains no personal information. Mapping references back to sensitive source records, authorization, erasure, encrypted storage and retention enforcement are future integrations, not implemented guarantees.

Legacy version 1 feedback mappings remain compatible as evidence inspection. They can contain bounded raw request text and must not be treated as safe training exports. Their candidate jobs now declare `executionAllowed:false`, `mode:evidence-inspection-only`, and cannot execute the offline ranker. This change does not silently convert legacy feedback into training labels.

## Evidence is separate from labels

The offline flow is permitted raw evidence → verification → grouping → conflict detection → controlled adjudication → validated label → versioned dataset.

`customer-learning-labels.js` groups by evaluation ID when supplied, otherwise search ID. A search cannot be assigned inconsistent evaluation groups. Evidence is sorted and fingerprinted; duplicate evidence IDs are rejected. Conflicts preserve disagreeing relevant/irrelevant claims and positive claims contradicted by deterministic rejection. Different request/catalogue/intelligence/locale snapshots cannot be labelled together.

Adjudication must explicitly approve a decision with its own ID, policy version, reason and adjudicated trust, review every evidence ID, and resolve all conflicting evidence references. Exactly one verified system snapshot must establish eligible IDs and passing hard constraints/fact integrity. Expected labels cannot contain ineligible IDs. A customer/outcome judgment is required: clicks, saves, continuation and business self-claims alone cannot supervise training. The system does not choose a winning party or infer correctness from a purchase. Controlled review can select a later correction; no chronological or commercial signal automatically overrides another party.

The pure label constructor validates a trusted offline decision envelope. A real authenticated adjudication service, reviewer authority, decision persistence and audit trail remain future work. SHA-256 fingerprints prove reproducible content binding, not the authenticity of an approver.

## Reproducible datasets and training

`customer-training-dataset.js` produces schema version 2 datasets with evidence/label schema versions, source evidence IDs/versions, dataset and label-policy versions, explicit creation timestamp, purpose, counts, split policy, partitions and canonical SHA-256 fingerprint. Invalid or unadjudicated groups are rejected with bounded reason codes, without copying their raw payloads into diagnostics.

The initial split policy is `interaction-sha256-80-10-10-v1`: SHA-256 of the canonical object `{policy, groupId}`, first eight hexadecimal digits modulo 100; buckets 0–79 train, 80–89 validation, 90–99 test. All evidence/labels for an evaluated interaction stay in one partition. This is reproducible and insertion-order independent, but proportions are approximate, and small datasets may lack held-out partitions. It prevents interaction leakage; correlated customers/businesses over multiple interactions require a future stricter split policy if the evaluation purpose needs it.

Training jobs bind base intelligence version, dataset version/fingerprint and purpose. Returned training metadata cannot claim another dataset, base or purpose. Schema 2 jobs require validated adjudicated datasets. Training and every artifact still declare `productionDeploymentAllowed:false`.

`customer-offline-ranker.js` implements a small, real, deterministic pointwise logistic relevance component. It learns three bounded features (`exact_match`, `concept_match`, `preference_match`) using bounded batch gradient descent and evaluates MRR on untouched validation/test groups. It requires positive and negative train examples and nonempty held-out partitions. Training configuration, feature names, weights, base/candidate/dataset versions and fingerprint are bound into an artifact SHA-256.

Tests actually train this component on synthetic, explicitly adjudicated fixtures. The result is an offline working algorithm, **not a trained production DEMEOS model**. There is no approved live feature extractor, live dataset or deployed adapter. The synthetic features separate their labels perfectly by construction; held-out MRR of 1 on those fixtures demonstrates executable training and partition handling, not real-world search quality. No LLM fine-tuning, semantic retriever, multilingual intention model or automated training has been implemented.

## Provider boundary and runtime modes

`customer-intelligence-interface.js` receives bounded request fields and only already-eligible possibility/work IDs. Extra profile/payment/business text is excluded. Request text is data; no adapter may concatenate customer/business instructions into system instructions. The rank-only response permits eligible IDs, numeric scores and bounded reason codes, not generated prices, attributes or explanations. Unknown IDs, duplicates, malformed output or unsupported fields invalidate the whole response. Exceptions and deadlines fall back to the approved baseline. Cooperative adapters receive an abort signal; a timed-out provider that ignores cancellation may continue its own work, but its later response cannot change the returned ranking.

This minimal adapter does not receive catalogue facts/features for semantic ranking and is not represented as working AI understanding. A useful approved provider needs a separately reviewed, minimal grounded input contract. No fake provider is configured in production.

`customer-intelligence-runtime.js` is an unwired server-side contract:

- Baseline is the default and does not call a provider.
- Shadow may compute ranking diagnostics, but returns the original visible order and original result objects.
- Candidate requires an authenticated server-owned approval resolver. Approval must match candidate version, relevance purpose, exact baseline rollback version and exact provider artifact fingerprint. Missing, rejected, timed-out or mismatched approval falls back.

Caller-supplied flags alone cannot authorize candidate mode. A production registry/approval loader and authenticated artifact verification still need implementation. Neither the runtime nor approval helpers write a registry, deploy a model or alter customer request behaviour. Diagnostics belong in private operational tooling, never the customer interface.

## Evaluation and promotion protection

`customer-intelligence-evaluation.js` accepts versioned judged cases and predictions. It supports binary relevance precision/recall, MRR, binary NDCG at an explicit cutoff, misleading match rate, unsupported/no-result correctness, hard-constraint violation rate, structured fact-integrity rate and clarification accuracy. Precision/recall are macro-averaged across cases; MRR/NDCG average only answerable cases. Empty expected and returned sets have precision/recall 1. Unsupported correctness considers no-answer cases; hard-constraint violation and fact-integrity rates are case-level and inspect all returned IDs/claims, including beyond the ranking cutoff. No claims is vacuously fact-safe, not evidence of useful explanations. Fact checks compare declared structured values exactly with approved facts; they are not a free-text hallucination detector.

Coverage distinguishes relevance, weak/misleading matches, unsupported/no-result, ambiguity, necessary/unnecessary clarification, negation, hard exclusions, must-haves/preferences, budget/date/time/location/distance/quantity/party context, paraphrase/noisy language, multilingual and fact integrity. Locale coverage uses the repository registry, exactly `en`, `es`, `fr`, `ar`, `pt`, `zh`, `hi`, `de`, `ja`. The additional nine-locale fixtures are synthetic contract smoke cases requiring human language review. They do not establish quality for those languages. Current fixtures do **not** meet full area coverage, so their reports cannot authorize promotion.

Versioned candidate comparison requires complete safe coverage, passing required suites, comparable baseline/candidate reports on identical judged-case fingerprints and metrics bound to those reports. Quality cannot regress relative to baseline, even when custom thresholds are looser. Any nonzero hard-constraint violation or fact-integrity loss fails regardless of ranking improvement. Legacy report helpers remain for backward-compatible comparison; they are not authenticated runtime authorization.

Explicit approval and rollback to the exact baseline remain necessary. `monitoringDecision` validates bounded hard-rule/fact metrics, requires the pinned baseline and signals rollback when integrity fails. It never mutates production. Monitoring ingestion, operational thresholds, registry activation, authenticated approval, real deployment and rollback execution are deliberately future integrations.

## Review and future work

Before any live learning/model use: approve source/purpose/retention policy; implement authenticated collection and versioned snapshot capture; preserve source permissions/revocation; implement adjudication and provenance storage; expand independently judged multilingual/constraint/fact datasets; choose stricter splits where required; compare actual baseline and candidate on the same held-out cases; approve feature/provider contracts; implement authenticated registry, shadow monitoring and rollback execution. None of these responsibilities is granted to raw customer behaviour, business claims, an external provider or an offline trained ranker.
