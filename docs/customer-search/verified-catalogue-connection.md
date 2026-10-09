# Verified catalogue connection audit

Baseline: PR 687 merged as `1714fb9fd2c792a9841849e22d418aec04dcec21`; its production deployment is READY.

The authoritative path is `persistence.getCustomerWork` → approved campaign publication rules → owned profile products and approved media delivery → `customer-public-work-contract` → category selection → existing deterministic eligibility and guarded ranking → existing Customer Experience contracts. No second catalogue is needed.

Existing safeguards: the repository joins campaigns to their business, requires approved supported campaigns, projects customer-facing campaign sections only, validates product ownership and continuation routes, and resolves approved media through the existing storage adapter. Search preserves hard constraints and classification comes only from the same offer's public evidence. Missing media does not prevent an otherwise valid offer; unsafe media cannot become product continuation authority. Provider configuration remains disabled.

Audit findings before implementation:

1. Category selection reconnects projected work by work ID and retained products by product ID. Duplicate identifiers can associate validated evidence with a different raw record.
2. The public product projection accepts duplicate normalized product IDs. Customer continuation identifies an offer by ID, so such records are ambiguous even when semantic eligibility uses object identity.
3. Published-offer classification suggestions select the first matching work and product before validation. Duplicate source identities must fail closed before any provider request.
4. Approved media derivative selection drops the validated asset's product relationship and purpose. Preserve those fields from the validated asset, never from the derivative, so the existing continuation gate can retain the exact offer association.

Plan: reject ambiguous identifiers at the shared catalogue boundary, preserve exact source records during category narrowing, and require a unique source for advisory classification. Keep established publication, pricing, availability, media, options, authentication, payment and UI contracts unchanged. Add regressions through the actual repository-to-search path and existing browser/HTTP gates.

Engineering fixtures validate these connections only. They do not represent genuine businesses or establish real-provider semantic accuracy.
