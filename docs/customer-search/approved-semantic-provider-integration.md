# Approved semantic provider infrastructure

This stage builds on merged #684. The production search registry remains unchanged: deterministic baseline, `categoryUnderstanding:null`. No vendor, external endpoint, credentials, authoritative approval service or production activation is installed. No external AI requests were made for development validation.

## Adapter and protocol

`customer-category-provider-integration.js` creates an immutable internal configuration compatible with the existing category-understanding boundary. Its definition specifies provider version, canonical HTTPS endpoint, `demeos-category-json-v1` protocol and `marketing-agent-categories-v1`. The artifact fingerprint also binds the canonical registry, response schema, fixed data-only instructions and literal rollback version. Changing endpoint, provider version, protocol, instructions or registry changes the fingerprint.

This protocol is provider independent, not a direct integration with a selected vendor API. A future approved provider/bridge must accept the JSON envelope and return the existing strict category response. Vendor-specific translation requires separate review; no vendor SDK or model has been selected here.

The request contains fixed instructions, a bounded response-schema description, the canonical category ID/sector/name triples, and only `text`, `locale`, `scope` in its data object. Customer/business text is never interpolated into system instructions. Source IDs, approvals, fingerprints, profile/payment/authentication data and expected evaluation labels are not provider inputs. Credentials are obtained from an internal resolver and used only as a Bearer authentication header. Customer authentication information is never used as provider credentials.

All provider JSON is untrusted. Byte bounds, JSON parsing, category identities, sectors, uniqueness, confidence and UTF-16 source offsets are checked before the existing independent source validation. No provider explanations, catalogue IDs, facts or additional fields are accepted. Private free text is blocked by the existing redaction guard plus mandatory reviewed source-policy permission. The redaction guard cannot determine all personal information; the policy service remains responsible for decisions about names, addresses, sensitive requests, retention and legal treatment. This code makes no legal conclusion.

## Authority and one-use source permission

The internal release service is called on every search, not cached across searches. Its decision must match exact version, computed artifact fingerprint, purpose, audience, locale and literal rollback baseline. Both audiences require provider approval and privacy/security review references. `production` additionally requires independent evaluation, regression, rollback and explicit activation decision references. These references are opaque authoritative service receipts, not provider claims. The trusted service must authenticate and validate actual reviews; this parser does not manufacture reviews or implement an authoritative registry.

`offline-evaluation` is the default factory audience. It permits controlled evaluation before semantic quality approval only when provider, privacy and security authority explicitly allows it. This does not authorize production use. Production configuration cannot be enabled by an environment boolean, request/header field or provider response.

Audience remains on the immutable integration. Customer search and published-offer classification accept only `production`; a missing or offline audience restores baseline before any release/policy/provider call. The separate internal `evaluateCustomerCategories` entry accepts only offline evaluation and is not selected by customer parameters. Controlled #684 fixtures explicitly declare production audience while retaining all prior assertions.

Release approval and source policy are joined through single-use, signal-bound capabilities. Policy permission is bound to the exact source fingerprint, text, locale and scope; direct calls to the provider object cannot send data without those internal approvals. Classification consumes permission once. Revocation is checked on subsequent searches. Independent source validation receives artifact/version/audience metadata internally and still must confirm exact source/candidate fingerprints and preserved constraints/exclusions. No suggestion publishes a classification or creates eligibility.

## Bounded HTTPS transport

`customer-category-provider-transport.js` implements JSON POST over normal certificate-validated HTTPS. Endpoints must be canonical DNS URLs without credentials, ports, query parameters or fragments. DNS answers are checked for loopback, private, link-local/metadata, mapped, multicast and special-use ranges. The connection uses the same checked address, preventing a second unvalidated resolution. Only global IPv6 unicast is considered, with additional special-range exclusions. Network tests use controlled DNS/request doubles, not real external traffic.

There are no redirects, retries, shared connection agents, custom TLS trust, cookie forwarding or response logging. Requests are at most 64,000 bytes, responses 16,384 bytes, with fatal UTF-8 decoding. JSON content type and HTTP 200 are required. Compressed, partial, oversized or malformed responses fail closed. Per transport instance, at most eight requests execute concurrently; overload rejects immediately. Construct one stable adapter per approved definition, rather than creating instances per customer request. Existing total 1–250ms understanding deadlines cover all authority/privacy/credential/provider/validation work. Transport aborts/timeouts destroy in-flight requests. A realistic provider latency budget remains to be evaluated before activation; this stage does not increase customer deadlines.

## Online search and business source

The existing sequence remains structured intention, validated category interpretation, shared catalogue selection, deterministic relevance/eligibility and guarded ranking. This stage adds no catalogue, semantic index, synonym phrase rules or new customer page. A category suggestion can narrow existing classified offers. It cannot make an unrelated/unverified product eligible or override budget, location, exclusions, availability, ownership or unverifiable temporal/capacity constraints. Arbitrary paraphrases still may have no sufficiently supported lexical result; semantic retrieval beyond safe category narrowing remains future work.

The existing exact published-offer helper continues to locate one requested product/service and apply the existing public projection, ownership, visibility and continuation checks. Its source policy must independently confirm current approved publication provenance. Only that same offer's name/description reaches classification. Other products, business slogans, private records and prices are excluded. Controlled test mode remains blocked. The helper is internal and has no publication/classification write endpoint.

Valid empty semantic advice now passes through independent source validation, rather than being accepted as an unverified no-result claim. It cannot discard canonical literal intent. Without configured intelligence, baseline behaviour is unchanged. Clause-wide English negation protection remains conservative. Multilingual interpretation requires per-locale authority and independent source validation; translated interface strings are not proof of semantic quality.

## Offline evaluation

`customer-category-provider-evaluation.js` connects the real adapter-compatible configuration to the existing immutable, label-free judged evaluation harness. It never sends case IDs, scenarios, expected labels or judgement metadata to providers. Baseline fallback is counted separately and cannot be reported as provider success. Pipeline accuracy, provider accuracy/coverage, unsafe-classification rate, rejected/unavailable executions and per-locale provider coverage are separate measurements. A release report additionally fails when provider execution is unavailable/rejected, any unsafe/incorrect case fails, fallback-only positives remain, or any of the nine actual locales lacks evaluated provider output. Negation blocked by deterministic protection is reported as baseline behaviour, not provider accuracy.

The nine locales are en, es, fr, ar, pt, zh, hi, de and ja, through one unchanged canonical registry. Existing specification-only examples and controlled transport/service doubles are engineering tests only. No independently judged multilingual dataset or real provider quality run is available today. Passing fixture tests cannot approve an artifact. Reports cannot activate, install, train or promote a provider.

Pipeline and baseline accuracy use actual deterministic fallback results. Provider-only accuracy and coverage exclude those fallbacks; rejected/unavailable executions still fail the release gate. Reports bind provider version, artifact fingerprint and complete metrics to a report fingerprint. Default real-output evaluation uses the 24 normal specifications; the three malformed/unknown-ID/wrong-sector fault-injection specifications remain in the generic harness and transport tests, rather than incorrectly judging a real provider for faults that were never injected.

Training, evidence export and promotion remain separate offline systems. No online learning, production evidence export, automatic promotion or business self-approval is added. Rollback is the existing disabled category configuration plus deterministic baseline, with artifact approval bound to `customer-category-literal-v1`.

## Remaining work before production activation

Select and explicitly approve a provider/protocol bridge, implement authenticated authoritative release/approval and reviewed data-policy services, integrate secure credential provisioning, independently validate source semantics/publication, independently judge and run all nine-language evaluation datasets, demonstrate latency and rollback, pass regressions and obtain explicit production activation approval. None of these decisions is inferred from fixture tests or this PR.

Only the existing 171 category classification data is used. No economic-system architecture, payment/authentication changes, Owner Workspace/Admin changes or Customer Experience redesign are introduced. This PR remains open for independent review and is not authorized for merge or production deployment.
