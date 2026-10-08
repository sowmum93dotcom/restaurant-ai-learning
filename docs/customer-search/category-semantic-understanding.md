# Controlled category semantic understanding

This stage extends the merged #681–#683 architecture. It adds an inactive provider-independent understanding boundary and a working offline evaluation harness. It does not connect external intelligence, train a model, establish independently evaluated semantic quality, write classification to businesses or activate an artifact.

## Online integration

The existing confirmed request enters `prepareCustomerSearch`, which keeps approved structured intention/constraints and calls `understandCustomerCategories` before category selection. The default server configuration contains `categoryUnderstanding:null`. The literal #683 interpretation is therefore unchanged, including clause-wide negation and `not only` handling.

An explicitly configured future category component may suggest references without exact category wording. Every reference resolves to the same immutable `marketing-agent-categories-v1` registry. No category alias table, duplicate registry, competing catalogue, business record or product is created.

The existing category selection narrows copies of the approved shared catalogue. Deterministic relevance, ownership, availability, price/budget/currency, location, exclusions and unsupported temporal/distance/quantity/capacity requirements remain authoritative. Eligibility and authenticated issuance still precede guarded ranking. Semantic category understanding cannot create lexical relevance or an otherwise unsupported match. Semantic catalogue retrieval remains separate future work; this stage does not claim that a provider suggestion alone makes every natural paraphrase return useful results.

Category diagnostics and validation fingerprints remain server-side. Existing public possibility projection, Customer Experience, Product Experience, Buy, authentication, My DEMEOS, language presentation and payment status are unchanged.

## Strict provider and validation contracts

Provider input contains only schema/dataset version, scope (`customer-request` or `published-offer`), actual locale, bounded source text, immutable canonical ID/sector/name entries, `dataOnly:true` and an abort signal. Customer/profile identities, work/product identifiers, business slogans, private administration, price/payment and authentication objects are excluded. Names in source text are not automatically anonymous: the reviewed internal privacy-policy hook must permit the exact content. Obvious contacts/secrets trigger the existing redaction guard and skip the provider rather than changing offsets.

Provider response has exactly:

```json
{"schemaVersion":"customer-category-understanding-v1","datasetVersion":"marketing-agent-categories-v1","candidates":[{"categoryId":"89","sectorId":"5","confidence":0.9,"evidence":{"start":0,"end":18}}]}
```

Offsets are JavaScript string offsets into the exact submitted text. The example specifies structure, not a judged result. There are at most eight unique candidates. IDs, sector relationships, finite confidence within 0–1 and bounded nonblank spans are strictly checked; names, invented facts, extra fields and accessor properties fail closed. Confidence is advisory and is never approval or an eligibility score.

A known category plus a real span does not prove semantic correctness. Before a suggestion affects selection, **separate server-owned hooks** must provide:

1. Artifact approval: exact version/fingerprint, purpose `category-understanding`, decision ID, locale and rollback `customer-category-literal-v1`.
2. Data policy: explicit permission for the exact request fingerprint and a policy version. For business offers this must authorize current publication/source provenance; a raw object or business assertion is insufficient.
3. Validation: an independently controlled decision bound to source scope, locale, exact request and candidate fingerprints, dataset version, preserved exclusions and preserved constraints.

None of these services is installed. No request, header, environment flag or provider response supplies them. The provider receives no approval service or configuration object. Approval/validation are operational guards, not supervised labels or training truth.

Any positive canonical categories already resolved by the literal parser must remain in the semantic candidate set, otherwise baseline is preserved. Providers cannot substitute another known ID for explicit canonical intent. Customer and business text are untrusted data; future approved adapters must not turn that content into system instructions.

One total deadline (1–250ms, default 150ms) bounds approval, policy, provider and validation together. Failure, unknown references, malformed output, denial or deadline restores the literal baseline. Abort checks prevent late upstream completion from starting further stages; adapters must also honour the supplied signal to stop underlying work.

## Negation and ambiguity

The #683 literal parser remains unchanged. Semantic execution conservatively skips any request/offer containing an explicit English negation or exclusion (other than `not only` in the same punctuation-bounded clause). Even a provider span from a positive substring cannot erase a negative elsewhere. Mixed positive/negative requests retain literal baseline interpretation rather than forcing semantic narrowing. Empty or unvalidated candidates preserve baseline. A source-bound independent validation service must assess general meaning, ambiguity and multilingual exclusions before those suggestions can be used. The English guard is not a complete linguistic or multilingual model.

## Business evidence

`suggestPublishedOfferCategories` is an internal preparatory function, not an endpoint or catalogue writer. It uses the existing public-work ownership/presentation projection to select one exact offer and submits only that offer's name and description. Its source-bound policy must independently confirm approved current catalogue provenance. Another product, private profile, business slogan or self-approved classification cannot substitute for that evidence. Controlled test offers are blocked from this function.

The returned semantic interpretation is a validated advisory, not persisted authoritative classification. Existing #683 literal published-evidence validation is not weakened. An approved classification review/write contract is still needed before semantic business suggestions become stored catalogue relationships; there is no automatic background classification or Business Owner/Admin modification here.

## Offline evaluation

`customer-category-eval-set.js` has 27 bounded specification cases: canonical names, wedding-food/office-cleaning paraphrases, ambiguity, multiple categories, negation/exclusions, punctuation, positive `not only`, unrelated requests and malformed/unknown/wrong-sector response scenarios. Nine draft paraphrase cases use locales read from the existing language registry: en, es, fr, ar, pt, zh, hi, de, ja. They are **not independently judged translations or semantic quality evidence**. Scenario names are evaluation metadata, never production phrase rules.

`evaluateCategoryUnderstanding` accepts a supplied evaluator and reports correct classification, safe fallback, incorrect classification and unsafe classification by case and locale. Unknown/duplicate IDs, malformed result contracts and positive results forbidden by a judged case are unsafe. Thrown evaluator execution is conservatively unsafe because it did not demonstrate fallback. The runtime itself catches failure and emits baseline.

The reproducible dataset fingerprint binds exact cases and judgement metadata. The initial strict release report requires independently judged cases, an exact independent review receipt and coverage of all supported locales; any unsafe result, incorrect result or fallback substitution fails it. The supplied specification-only cases cannot pass even with a review boolean. Controlled oracle/test doubles validate this harness and contracts, not AI quality. This report cannot install, approve or promote an artifact; existing independent promotion and rollback gates remain required.

The shared registry ID-list validator checks every own index explicitly and returns an immutable dense snapshot. Sparse arrays, inherited/accessor indices, duplicate or unknown IDs cannot be accepted as evaluation results or expected labels. Comparison does not invoke overridden array callbacks/iterators. The existing catalogue category selector uses the same check, so malformed sparse interpretations preserve the baseline universe rather than narrowing it. This corrects the independent Codex review finding without changing category data or search authority.

Evaluation validates and freezes sanitized copies of all cases and expected labels before fingerprinting or calling an evaluator. It captures independent-review eligibility before execution, so caller/evaluator mutation cannot change labels, judgement, locales or approval during a run. The evaluator receives only case ID, locale, source text and response-scenario metadata; expected labels and safety/judgement policy stay inside the harness. Extra/private case fields and accessor/sparse case inputs are rejected. Controlled oracle tests deliberately use an external specification fixture; that fixture is not passed as intelligence input or claimed as AI quality.

## Remaining inactive work and limitations

Approved providers, authoritative artifact registry, reviewed data policy, independent source/semantic validation, independently judged multilingual evaluation, semantic retrieval and business classification review/write workflows remain absent. No new source document columns, economic-system behaviour, permissions, units, payments, online training, evidence export or promotion are introduced. Only the existing 171 category data is used. Production configuration remains baseline, ranking shadow/candidate controls remain unchanged, and this PR requires independent review before merge/deployment.
