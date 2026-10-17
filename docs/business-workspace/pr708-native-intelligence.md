# Native product intelligence, PR #708

## Authoritative integration points (inspected before implementation)

- `data/marketing-agent/categories-v1.json`: exactly 9 sectors, 171 categories, stable IDs 1–171, dataset version marketing-agent-categories-v1.
- `api/_lib/marketing-agent-categories.js`: validates hierarchy and immutable references; sole registry authority.
- `api/_lib/customer-category-classification.js`: deterministic canonical phrase matching, bounded clause negation, advisory validation. Its interpretCategories boundary accepts at most 500 characters. Reused directly; no competing taxonomy.
- `api/_lib/customer-category-understanding.js`: provider-independent semantic boundary; no provider installed. No provider configuration is passed by Selling intelligence.
- `api/_lib/customer-search-{service,understanding,constraints,ranking}.js` and `customer-possibility-contract.js`: existing search processing and exclusion handling. Customer interfaces and retrieval remain unchanged.
- `test/marketing-agent-category-registry.test.js`, `test/customer-category-{understanding,search-integration,evaluation}.test.js`, `test/customer-semantic-retrieval.test.js`: existing category and search regression gates.
- `api/_lib/selling-category-fields.js`: initial reviewed authoring definitions for categories 9, 10, 11, 39, 81; other categories retain base editor.
- `api/_lib/selling-dashboard.js`: Clerk identity, SQL ownership, Preview isolation and current product/editor API.
- `api/_lib/selling-submissions.js`: deterministic prerequisites, immutable publication snapshots, independent mandatory safety/category-fit/media-consistency receipts. Assistance does not supply these receipts.
- `api/_lib/persistence.js`, `database.js`: existing Neon/Postgres repository and additive schema management; product JSONB catalogue and private media assets.
- `api/_lib/media-asset-contract.js`, `selling-media.js`, `media-processing-driver.js`: stored image dimensions, size, format; video duration, dimensions, private processed derivatives. Existing image guidance recommends width 1200px; this is advice, not publication approval.

No external inference, model weights, new taxonomy, new search engine, paid infrastructure or Production changes are authorised. Actual Preview writes remain blocked by incomplete owner two-step sign-in.
