# Marketing Agent category data integration

## Scope and source

Starting main is `71c5b58abe51e7bd76721bb4fed533ee749cc817`, the merged PR #682. This stage adds classification DATA to that same Customer Experience search path. No second catalogue, business records, product/service records, search engine or customer page is created.

Source: the supplied `DEMEOS_171_Category_Economic_Architecture_TCS_Lumi_Final.docx`. Source file SHA-256 is `f80079f616bd03991f52ce4258c9d76e3756dc09a77e6614fe432019734e6285`. Extraction used the nine sector headings and only the ID and Category columns of their nine category tables. Each table contains 19 categories. The source document itself is not copied into the repository.

`data/marketing-agent/categories-v1.json` contains exactly nine sector names, 171 category IDs/names, their supplied sector relationships and dataset version `marketing-agent-categories-v1`. Supplied numerical IDs are represented as stable decimal strings; IDs are not translated or renamed. The ordered canonical category projection SHA-256 is `80ac3fdf14ac050c1607221693675495b8841a746b2c605e9c06ceacc373f6fd`, pinned by a regression test to preserve every name and relationship.

Some canonical names refer to economic-system components. They are inert classification strings only. There is no runtime implementation of those components. No Type, Vendor, Customer, Social Commerce, Micro-Jobs or Event Mapping columns were extracted. No SSC, units, MDVS, ledger, governance, workforce, economic permissions, compliance or transaction architecture was imported.

## Existing contracts retained

The six entries in `js/customer-item-contract.js` are product presentation/option contracts, such as `fashion.apparel` and `sports.sessions`. They are not the supplied 171-category registry and are unchanged. Presentation kind, price, options, variants, selections and purchase continuation keep their existing authority.

The new read-only server registry validates exact schema, nine sectors, unique IDs 1–171, their supplied sector ranges and names, and dataset version. Runtime records are frozen copies; caller mutations of the JSON-loader object do not mutate the registry. It has no write endpoint, environment activation switch or customer-controlled creation path.

## Category references and publication boundary

An optional product/service reference has this form:

```json
{"datasetVersion":"marketing-agent-categories-v1","categories":[{"categoryId":"10","sectorId":"1"}]}
```

The shared public-work contract validates references only against the canonical dataset and the SAME ownership-validated public offer's name/description. A canonical category name must occur as positive literal published evidence. Unknown IDs, wrong sectors/versions, duplicate or oversized references, extra approval fields and obvious negated category evidence cannot establish classification. A business-level classification is derived from those validated product/service references; a business's self-declared classification is not accepted as authority. Cross-business products remain excluded by the existing ownership contract. Media keeps its existing validated relationship to the product/service; no new media truth or independent media classification is invented.

This is bounded published-evidence validation, not independently adjudicated semantic classification. Publication and ownership remain governed by existing DEMEOS contracts; literal category text does not create new verification, capability, availability or business facts. The layer does not reward classification by inserting offers into results. Broader semantic validation and an approved classification review/write workflow remain future work.

`getCustomerWork({forCatalogueValidation:true})` retains the classification in the existing server-only catalogue projection. The default repository read and default public-work projection strip it. `forSearchClassification` is a server function option, never a request flag. Existing public Discover and possibility payloads do not carry category references, registry IDs, sector IDs or dataset versions. No Business Owner Workspace or Admin Panel is modified. Future approved organisation workflows can reuse these validators and the same dataset instead of building another registry.

## Actual online flow

Confirmed request validation and optional approved understanding remain unchanged. `prepareCustomerSearch` then interprets category names from the original request, conservatively retaining multiple matching canonical categories. Category selection narrows copies of the existing catalogue before the current matcher, hard constraints, result cap, authenticated issuance and guarded ranking. The same ownership/publication rules and #682 runtime still decide what can be shown.

The initial resolver recognises complete canonical names after case/Unicode/punctuation token normalisation. It does not invent category aliases or infer that a jacket automatically belongs to a particular supplied category. Unknown wording, excessive ambiguity or an invalid advisory interpretation preserves the original request and baseline universe. Unclassified offers are preserved rather than falsely excluded. Classified offers can be narrowed by their existing product/service links, but category similarity cannot create relevance or substitute for requirements.

Multiple relevant categories stay candidates. Negated category names are not positive category intent. Budget, exclusions, explicit availability, exact place and unsupported date/time/distance/quantity/capacity checks remain independent and authoritative. The category layer cannot add a business, product, service, price or availability claim. It cannot change customer selections, payment, authentication or ranking approval.

## AI, languages and privacy

`validateCategoryAdvisory` provides a strict provider-independent future advisory response boundary: a known dataset version and bounded unique approved category IDs tied to literal spans of the request. Unknown IDs, renamed categories, unsupported spans and extra fields fail closed. It is not an active provider call. No external provider is connected, no candidate artifact is installed and no approval bypass is added. Baseline remains the default; shadow is invisible and candidate ranking still requires exact artifact/purpose/version/rollback approval.

The nine Customer Experience locales and presentation types remain unchanged. Canonical registry identity is separate from future display-name localisation. The current canonical-name resolver and synthetic tests do not establish multilingual semantic intelligence. Independently judged interpretation, negation, preference/requirement, clarification, relevance and fact-integrity evaluation is still required.

No private profile, authentication, payment or business-administration information is attached to the category dataset or passed to a provider. Classification metadata is not added to ranking-provider payloads. The catalogue snapshot hash includes the internal validated classification for reproducibility, without exporting raw private data. Evidence collection remains disabled by default; existing permission/provenance gates remain in force. Controlled classification fixtures cannot become genuine production learning evidence, and references are not learning labels. No online training or promotion is introduced.

## Validation and remaining work

New tests pin every supplied category name/relationship; validate read-only IDs, schemas and sector relationships; test product/service and business linkage, cross-business exclusion, negated claims, invalid advisory responses, multiple categories, unclassified fallback, deterministic constraints, invisible metadata, repository integration, controlled-evidence separation and baseline/shadow/candidate protection. The real browser-to-HTTP gate adds category narrowing alongside the existing budget and location checks. Existing tests are not weakened.

Final local validation: complete Node suite 1,277 passed; focused #682 search/intelligence integration suite 35 passed; category tests 16 passed. All runs had zero failures, skips or cancellations. All eight existing Customer Experience browser gates and the enhanced real browser-to-HTTP gate passed at 390px, 820px and 1440px. Git diff --check passed. These are controlled integration results, not independent multilingual or production AI-quality evidence. Local browser gates use the existing scripts with a runtime Chromium executable shim; no test expectations or Customer Experience UI are changed by that setup.

Remaining work is an approved classification review/write workflow, independently judged semantic and multilingual mappings, separate display-name localisation where needed, and the existing #682 approved provider, authoritative data, privacy-policy and artifact-registry services. This stage does not activate any of them. Review authorisation is required before merge or production deployment.
