# AREA 1 online intelligence integration

## Audited main before integration

Starting main: `4e0848ef704f0ddf84e6bdee7ee3732fa94f9010` (merged PR #681).

1. `customer.html` hosts the single I Know What I Want form. `js/customer.js` collects `customer-intention-text`, an optional canonical intention and optional `customer-place`.
2. `showUnderstanding` builds a local `js/customer-understanding.js` summary and posts intention/customerText/clarificationText to `/api/customer/understanding`. Vercel rewrites to `api/public-config.js?resource=customer-understanding`.
3. That route resolves server identity, rejects business owners, reads only permitted own preference/feedback guidance, and calls `buildTrustedCustomerUnderstanding`. The existing summary is deterministic. The customer confirms it.
4. `requestCustomerPossibilities` sends the five-field confirmed understanding and optional place to `api/customer/possibilities.js`. The server checks exact keys, bounds, source/state and recomputes the deterministic summary; it never trusts a browser-generated interpretation.
5. `selectCustomerCatalogue(repository.getCustomerWork(), req)` is shared with Discover. The repository publishes only approved supported campaigns, validates public products/media/continuations and excludes private business administration. Controlled examples require existing server/query/header rules and cannot replace an available genuine catalogue.
6. Authenticated real customers save their confirmed intention through `saveCustomerIntention`. Permissioned own preferences/feedback are guidance only. Controlled examples skip identity/history/issuance.
7. `findCustomerPossibilities` applies public validation, availability, exact declared place, exclusions, same-offer requirements, bounded deterministic relevance and existing guidance ordering.
8. Authenticated real results pass trusted issuance and confirmed delivery. Only issued results return. `js/customer.js` validates/renders them through `renderCustomerPossibilities`; Product, Buy and My DEMEOS use the established continuation contracts.

Before this stage, PR #681's provider/runtime/evidence/training helpers were not called by this HTTP search path. Its logistic ranker trained offline only on synthetic fixtures. Explicit monetary/date/distance requirements had no complete enforcement in the online path. The repository has no persisted customer training consent, approved search provider, production artifact registry or authenticated adjudication service.

## Actual implementation in this stage

`customer-search-service.js` now sits in `api/customer/possibilities.js`. `prepareCustomerSearch` derives a versioned structured intention from the already validated confirmed request, optionally calls an explicitly approved understanding adapter, then calls the existing `findCustomerPossibilities` against the same catalogue. An optional server-only eligibility callback applies additional hard checks **before the existing five-result cap**. The existing preference/feedback guidance and deterministic ordering remain in place.

After authenticated issuance and delivery filtering, `completeCustomerSearch` invokes the guarded ranking runtime using only the final eligible issued set. Customer JSON still contains only the existing possibilities/place/test-mode fields. Private diagnostics and extracted-intention metadata never appear in the response.

The structured contract represents expressed concepts, requirements, preferences, exclusions/negation text, budget/currency, date/time, explicit place, distance, quantity, party size, locale and ambiguity. Unexpressed values remain null/empty; category remains unresolved rather than invented. The deterministic extractor is deliberately bounded and English-oriented, with explicit currency markers and existing concepts. It is not multilingual AI understanding or a new general keyword engine. An approved provider can select bounded literal spans with strict field/context validation; it cannot invent values, identifiers or remove baseline restrictions. Independently evaluated semantic normalization and richer multilingual extraction remain future work.

Explicit supported colour/waterproof requirements require positive published evidence. Negated published attributes do not satisfy a positive requirement. Parsed fixed/upper-bound prices must satisfy an explicit monetary cap in the same currency; unknown/from/contact pricing cannot establish it. Available variants cannot exceed that cap. Known colour preferences introduced by prefer/preferably/ideally remain preferences. An explicit availability requirement cannot be satisfied by contact/unknown availability. Existing exclusions and availability rejection still run first. Exact declared city matching remains conservative; no geocoding or distance inference is introduced.

The public catalogue lacks authoritative dated availability, inventory counts, party capacity and distance contracts. Requests requiring those facts retain their expressed fields and produce no supported result rather than invent support. This is a deliberately incomplete capability, not a claim to handle those requests intelligently. Richer date/time/currency-language interpretation, budget preferences and multi-clause ambiguity need independently judged expansion. Existing optional place remains the only supported city boundary; automatically extracted English place phrases are narrow and do not establish proximity.

A missing place for “near me” asks one town/city clarification using the existing panel. Its nine-language question uses the actual locale registry. Filling that question updates only place and preserves the original request. A broad “I need a jacket” does not acquire colour/size/budget/location questions. The pre-confirmation summary remains deterministic and customer-confirmed; provider interpretation occurs server-side afterward, before retrieval. Provider failure cannot replace or corrupt that summary.

## One catalogue and preserved business/product ownership

No search database or alternative catalogue is added. The same `getCustomerWork` approved query still supplies Discover and search. A genuine integration defect was found: default repository projection removed business ownership identifiers before a second public validation, causing approved products to disappear. `getCustomerWork({forCatalogueValidation:true})` now preserves only the server-side validated ownership relationship until the existing public contract strips it. Both customer read routes use this option. Default repository/public output still excludes business IDs, and cross-business product rejection remains unchanged. This is a shared read-only receiving-contract fix, with no owner/admin workflow change.

## Provider and deployment modes

`customer-search-registry.js` returns a frozen baseline configuration: no provider, artifact or evidence exporter. There is no customer-controlled mode, environment boolean that grants approval, installed external AI provider or active candidate. Enabling any provider requires a separately reviewed server-owned adapter/configuration and purpose/data policy. The code does not authenticate a future approval database by itself.

Understanding has separate query-understanding approval bound to version, artifact fingerprint, purpose and exact rollback schema. A provider receives only the bounded current text/locale plus an explicit data-only contract. It returns spans, not prompt messages, facts or business/product IDs. Malformed fields, oversize spans, invented negations/places and timeout/exception fall back completely. Obvious contact/secret redaction changes offsets, so those queries keep baseline understanding. General redaction is not a guarantee that arbitrary free text contains no personal information; provider activation still needs policy review.

Ranking payloads allow only eligible possibility/work IDs and bounded approved public content/location/product descriptions, availability and normalized pricing. They exclude private profiles, preference/feedback objects, account identifiers, business administration, contacts/routes, payment data and arbitrary extra fields. Provider responses contain IDs/scores/reason codes only; no generated explanation becomes customer fact. Any unknown/duplicate/malformed ranking fails entirely to baseline. The bounded public evidence projection is validated before dispatch. Customer/business text is data, never system instructions.

- Baseline: established deterministic order remains customer-visible.
- Shadow: same eligible set is evaluated; complete shadow order includes unscored candidates in baseline order. Visible order and original objects remain baseline. No provider response is awaited by the customer path.
- Candidate: an external approved adapter can reorder only eligible original objects through the existing artifact/purpose/version/rollback approval contract. No candidate is configured here. PR #681 offline artifacts are explicitly refused in customer-visible candidate mode.

`@vercel/functions` 3.9.11 supplies the real Vercel `waitUntil` lifecycle hook. A scheduler refuses to start work if registration fails; no unsupported fire-and-forget path is introduced. Ranking timeout defaults to 150ms; underlying #681 bounds remain enforced. Understanding approval and execution each have a bounded 150ms default, at most 250ms each. Shadow/evidence tasks run outside the awaited response. Adapters receive cancellation signals where supported; a provider/writer that ignores abort may continue its own work, but cannot subsequently change returned customer results. `waitUntil` preserves invocation lifetime, not durable queue guarantees or delivery retries.

## First offline artifact connection

The #681 logistic ranker is real offline code, trained/tested on synthetic examples only. `offlineShadowProvider` can read a reproducible artifact and evaluate public bounded features of the same eligible set. It requires the exact base version and an explicitly declared `public-relevance-features-v1` mapping; no artifact is installed or trained online. Features are bounded evidence-count, existing relevance-basis indicator and zero private-preference contribution. This feature mapping is an initial integration definition, not a calibrated semantic feature set. Synthetic training success does not validate transfer to these real features. Actual artifact/feature compatibility and ranking quality need independent offline evaluation before any shadow configuration; candidate-visible activation is prohibited for these artifacts.

## Multi-party search-event connections

Search completion connects to `emitSearchEvidence`. Authenticated stored relevance feedback, Interested selection and saved possibility actions connect to `emitCustomerAction` through `queueCustomerAction`. These hooks are **disabled by default**: there is no current stored learning consent, authorized policy service, interaction-link resolver or evidence sink. Existing guidance preferences never grant training permission.

A configured trusted policy service must authorize purpose, consent applicability, privacy/retention classification and learning consent where required. Search/system records can then retain eligible/rejected IDs, conservative rejection codes, actual baseline/visible/shadow order, mode, candidate version/fingerprint when supplied, schema version and clarification/integrity checks. A catalogue version is explicitly defined as a SHA-256 of that approved public snapshot, not an invented database revision. Search/request references are fresh opaque UUIDs; raw queries and identities are not exported.

Business source evidence additionally requires a trusted policy-supplied approved source decision and verification reference for that actual published work. Publication alone is not used to invent a verified business identity or semantic truth. Those records are observations of published information, not labels. Customer action exports require a server-owned resolver linking the authenticated recorded action to an existing verified search reference. No client-supplied search ID can establish that linkage. Relevant feedback is a customer claim; “Not quite”/“Something different” remain corrections, not automatic negative truth. Selection/save remain observations. Comments and account identities are excluded. Outcomes/fulfilment are not exported: the repository has no verified outcome contract for this integration.

Controlled examples are rejected from all genuine search/action learning exports even if a policy is configured. System/business evidence alone cannot construct supervised labels. Raw action evidence cannot automatically become a label. Verification, grouping, conflict review, adjudication and training remain the separate #681 offline pipeline. No collection endpoint, retention service, dataset writer, live training, automatic promotion or model mutation is added.

## Evaluation, promotion, monitoring and rollback

A versioned synthetic integration set contains 19 English engineering judgments covering exact/natural requests, requirements, exclusions, budget, dates, time, location, distance, quantity, party context, preferences, ambiguity/clarification, paraphrase, noise and no-result/fact checks. It runs the actual search service through the #681 evaluation harness. Its report deliberately remains incomplete for multilingual promotion; correct synthetic assertions do not establish real search/model quality.

Focused integration tests run the real handler with trusted repository/identity/issuance fixtures and exercise baseline/shadow/approved-candidate contracts, full fallback, constraints, privacy projections and guarded evidence. A real HTTP browser gate uses existing handlers and a controlled in-process repository, without Playwright response mocks for search/understanding. The existing eight journey gates remain unchanged. The new HTTP gate joins the existing GitHub browser workflow.

The nine supported locales are `en`, `es`, `fr`, `ar`, `pt`, `zh`, `hi`, `de`, `ja`. Question/presentation tests establish locale coverage, not multilingual intelligence quality. #681 judged-evaluation/promotion gates remain authoritative; missing coverage, hard-rule violations or fact-integrity failures cannot be bypassed by this integration. No new report is presented as independently reviewed production model quality.

Rollback/default disablement means retaining the frozen baseline with providers/artifacts/exporters unset. Approved candidate mode still requires the exact rollback baseline and cannot create eligibility. #681 monitoring/promotion helpers remain available offline; a signed/authenticated production artifact registry, approval service, telemetry ingestion, automatic rollback executor, broader judged multilingual cases, authoritative dated/capacity/distance attributes and approved provider activation are future work. Payment and authentication authority remain unchanged.

## Observed local validation

Complete Node suite: 1,255 passed, zero failures/skips/cancellations. Focused integration suite: 29 passed, zero failures. All eight existing Customer Experience browser gates passed at 390px, 820px and 1440px. The additional real HTTP integration gate passed at the same three widths. Local Node version was v24.19.0, Playwright 1.62.1 and Chromium 153; GitHub independently runs its existing Node 22/Playwright 1.55.0 workflow. `git diff --check` passed. These tests are controlled local verification, not live production or multilingual intelligence-quality verification.

## Changed-file inventory

- `.github/workflows/customer-browser-gate.yml`
- `api/_lib/customer-evidence-provenance.js`
- `api/_lib/customer-intelligence-interface.js`
- `api/_lib/customer-intelligence-runtime.js`
- `api/_lib/customer-possibility-contract.js`
- `api/_lib/customer-understanding-context.js`
- `api/_lib/persistence.js`
- `api/customer/possibilities.js`
- `api/customer/work.js`
- `api/customer/work/[campaignId]/participation.js`
- `api/public-config.js`
- `js/customer-interface-language.js`
- `js/customer.js`
- `package.json`
- `api/_lib/customer-search-constraints.js`
- `api/_lib/customer-search-events.js`
- `api/_lib/customer-search-intention.js`
- `api/_lib/customer-search-ranking.js`
- `api/_lib/customer-search-registry.js`
- `api/_lib/customer-search-service.js`
- `api/_lib/customer-search-understanding.js`
- `browser-checks/customer-intelligence-integration-gate.js`
- `docs/customer-search/online-intelligence-integration.md`
- `test/customer-search-api-integration.test.js`
- `test/customer-search-evaluation-integration.test.js`
- `test/customer-search-events-integration.test.js`
- `test/customer-search-intention-integration.test.js`
- `test/customer-search-ranking-integration.test.js`
- `test/fixtures/customer-search-judged-cases.cjs`

Vercel lifecycle reference: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
