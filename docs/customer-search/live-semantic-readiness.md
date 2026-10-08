# Live semantic readiness and end-to-end retrieval

Baseline: `d5bb44b51e8c02f6443bc5c0f5f65535f83e011e` (merged PR 686). External AI remains disabled; this change does not provision an authority service, credentials, provider or activation switch.

## Existing implementation reviewed

PR 683 supplies the immutable canonical 171-category classification dataset, same-offer classification validation, internal repository projection and deterministic narrowing. PR 684 adds provider-independent semantic understanding and same-offer review candidates, with separate source-bound validation. PR 685 adds the disabled HTTPS protocol adapter, one-use approval/privacy capabilities, bounded transport and offline provider evaluation. PR 686 adds server-controlled provider identity/model/configuration approval, privacy/security/rollback/activation reviews and independently reviewed nine-language evaluation verification.

The missing connection was retrieval: approved categories narrowed the catalogue, but lexical product relevance still rejected paraphrases without shared English words. No new catalogue, registry, search engine or Customer Experience is introduced here.

## Retrieval authority and constraints

Only successful `validated_category_understanding` with one source-bound canonical candidate AND an independent exact category-only phrase review enables semantic retrieval. The optional server-only `resolveRetrievalPhrase` dependency must authenticate a pre-existing, independently reviewed phrase record, not generate/approve a phrase from provider output or the request. Its strict receipt binds the exact phrase, category, locale, request and candidate fingerprints, decision ID and phrase fingerprint. It receives adapter provider identity/fingerprint/audience context internally; nothing from this review is transmitted externally. No phrase service is provisioned or enabled in this PR. Missing, malformed or unavailable phrase review grants no additional retrieval relevance. This prevents a provider evidence span from swallowing unverified qualifiers such as vegan, gluten-free or accessibility. Empty or multiple candidates do not gain additional relevance authority. When reviewed semantic retrieval is active, lexical sibling matches cannot bypass its same-product category/residual requirement. Returned semantic products are only the same-offer verified matches. The reviewed category replaces primary lexical category terms even before a with-clause; remaining qualifiers still need same-offer evidence. Final matching explanations and deterministic strength are rebuilt only from offers surviving hard-constraint filtering; rejected or unclassified sibling copy cannot influence semantic ordering or the result cap. The existing internal public projection independently revalidates each product's classification against its own name/description and ownership. Only currently visible, ownership-valid products with a matching validated classification can gain this relevance basis; business headline classifications, another product's evidence and unclassified offers cannot establish a semantic match.

The validated category span is masked only for residual lexical verification. Every remaining meaningful term requires evidence from the same product. Original request checks remain active for exclusions, explicit service families, particular offer requirements and additional requirements. Child-specific requests now require child-specific offer evidence. Existing structured intention and `constrainPossibility` still independently enforce budget, availability, place, ambiguity and unverifiable date/time/distance/quantity/capacity. Advisory text never replaces the original request used for those checks. Ranking and authenticated issuance remain downstream and unchanged.

Returned products remove internal classification; canonical IDs, approval receipts, source fingerprints and semantic candidates stay server-side. The result uses the existing product relevance schema and actual published names capped to the existing 60-character evidence limit. The existing five-result limit and public work distribution limits remain unchanged.

This is conservative category-level retrieval, not translation of arbitrary product qualifiers. Same-source validation must establish that the interpreted span describes a category request and preserves all remaining constraints. Unknown linguistic constraints require denial/clarification by that independently reviewed service. Automated fixtures cannot certify that service or real semantic accuracy. Common negative forms in all nine supported languages additionally keep baseline behavior before any provider request. This finite safeguard is not a complete multilingual language parser.

The HTTP handler now passes the existing catalogue test-mode flag into preparation. Controlled searches bypass query-understanding, category-understanding, ranking and evidence providers. Same-offer classification already denies controlled mode. Existing production privacy authority requires `controlledTest:false`, verified source and minimum-data review. No test catalogue or private customer/business objects are supplied to providers.

## Future HTTPS protocol contract

The existing `demeos-category-json-v1` adapter is provider-neutral. An explicitly approved bridge must implement its exact JSON envelope and response, honor the approved schema-2 model version, and treat text as data. A provider-native API with a different contract cannot be pointed at this adapter without a separately reviewed bridge.

Request: fixed instructions and response schema; canonical registry; bounded text, locale and scope; schema/protocol/dataset versions and schema-2 model routing metadata. UTF-16 evidence offsets refer to the exact original text. No identities, source IDs, payment data, evaluation labels, private profiles or catalogue objects are included. Response: exact schema/dataset and at most eight unique canonical category/sector/confidence/evidence rows. Extra facts, names, prices, unknown IDs, malformed bounds and opaque/accessor collections fail validation.

Credentials are resolved server-side only after current release and source permission, bound to one abort signal. HTTPS transport uses checked public DNS addresses for connection, TLS verification, no redirects/shared agent/retries/custom trust, bounded bodies and responses, abort/deadline handling and concurrency limits. Existing tests verify credential ordering, replay rejection, partial/non-JSON/compressed/oversized responses and timeout fallback. No live external HTTP/model request is authorized by this stage.

## Engineering verification

New controlled tests traverse semantic understanding → canonical registry → same-offer classification → deterministic eligibility → existing guarded completion for all nine locales. They cover original constraints, residual terms, cross-product evidence, mismatch/ownership/availability, private text, controlled mode, failures and unchanged classification records. The real browser-to-local-HTTP gate also exercises approved fixture semantics through the existing handler, repository and rendered Customer Experience at 390, 820 and 1440 pixels. The fixture runs in-process and never activates an external provider.

All fixture outcomes are engineering evidence only. The independent evaluation and production receipt requirements remain intact. Real accuracy, linguistic adequacy, provider execution attestation and privacy adequacy remain unverified until independent real-output evaluation.

## Required before real-provider activation

1. Explicitly approve exact provider identity, HTTPS bridge endpoint, model version and configuration fingerprint.
2. Provision authenticated, revocable approval/privacy/source-validation/exact-category-phrase-review/evaluation services and protected credentials. Customer/request/provider data cannot implement these services.
3. Independently judge real outputs across all nine locales and every required evaluation dimension; bind valid dataset/report/artifact fingerprints and attest real executions.
4. Complete security, privacy, end-to-end regression, latency and rollback reviews with the literal baseline authorized as rollback.
5. Obtain explicit production activation authorization and separately review installation in the server configuration. Current production registry remains disabled.

Keep this PR open. Do not merge or deploy production.
