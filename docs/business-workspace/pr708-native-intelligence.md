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

## Implemented boundary and contracts

`selling-native-intelligence.js` is a pure in-process rules engine. It reuses `interpretCategories`, the registry validator, category field definitions, submission prerequisites and media contract limits. It returns stable rule IDs, severity, affected field, explanation/correction codes and validation status. Rule-supported matches, plausible candidates, conflicts, insufficient information and unsupported classifications are distinct; no percentages are invented. The classifier's existing 500-character boundary is preserved, with an explicit unsupported finding for longer title/description combinations. No inference is substituted.

`selling-intelligence-service.js` validates editor overlays and binds saved analyses to the actual product revision. The authenticated existing dashboard endpoint accepts:

- POST `action: analyze-product`, `productId`, `productRevision`; optional `editor` with only name, description, SKU, pricing, availability, registry reference and category fields. `unsaved-draft` with revision `new` supports authoring assistance before persistence.
- POST `action: review-intelligence`, `productId`, `productRevision`, `inputHash`, `confirmed: true`; requires a current saved analysis. It records review only; it does not change publication state.

Both operations follow existing Clerk identity, SQL business ownership, permission and Preview isolation checks. Media/variant/submission/permission data cannot be supplied through editor overlays. Unsaved/changed-editor analyses are returned without persistence; unchanged saved records persist privately. Candidate selection changes only the form, then the ordinary save path validates and audits the explicit category selection. Prices, inventory and publication are never changed by analysis.

`selling-model-boundary.js` documents identity/version, capability, schema versions, provenance, resource usage and execution limits. There is no installed executor, HTTP transport or request/environment switch. Execution returns unavailable with null output. Its conservative result validator accepts only structurally valid registry classification data; visual semantic results remain unsupported. A real runtime would still need schema-specific independent verification, deadline enforcement and resource measurement. This is an extension contract, not an operational self-hosted model.

## Persistence, caching and auditing

The additive schema keeps one latest private result per business/product in `demeos_selling_intelligence`; analyses do not enlarge the authoring JSONB. Immutable idempotent `analyzed` and `vendor-reviewed` events are stored separately, keyed by business/product/input hash/action. Category saves attach the explicit previous/current registry category to the existing product submission history. Analysis results include business/product/revision, input hash, registry/rule/field versions, timestamps, findings, lifecycle, review actions and processing metrics.

The fingerprint covers the authorised business profile (including duplicate candidates), product, stock and selected raw media metadata. A changed product, business context, stock revision, media metadata or version invalidates reuse. Results also expire after 24 hours or an earlier recorded validation-receipt expiry. The client clears findings on editor/context/stock changes. On refresh, analysis is explicitly requested again and a current saved result can be reused; analysis does not run automatically on page loads.

Writes compare the actual SQL profile, inventory revision and exact bounded product-media metadata in one statement, rechecking SQL ownership. Stale writes return 409. Concurrent identical analysis/review retries do not duplicate audit events. Responses are private/no-store. No private media files, object keys or credentials are sent to models or logs.

Limits: one product/request, 10,000 authorised catalogue records for duplicate scanning, 25 returned duplicate candidates, 64 media checked (a 65th record triggers a limit finding), bounded editor strings and no automatic retry/job fan-out. Current inexpensive rules run synchronously on explicit request; no background worker is introduced. Metadata reads use a product-scoped SQL query plus an additive business/product media index. There is no second search index or taxonomy.

Migration/rollback: the existing schema manager creates new tables/index idempotently. No product or media rewrite occurs. Rolling back application code leaves the new tables unused; retain audit data rather than dropping it. No Production migration was executed. Audit retention policy needs a reviewed operational policy before broad live rollout; current API never returns unbounded audit histories.

## Supported capabilities and deliberate holds

- Completeness: authorisation, title, description, category/reference and required attributes, price/availability/stock prerequisites, variant identities/SKUs/pricing and technical media integrity.
- Duplicates: normalised SKU, or normalised title plus category, within the owned profile only; advisory references, never deletion or automatic merging.
- Images: genuine dimensions, format, bytes, state, ownership/association, main image and existing 1200px width advice. Repeated gallery/private processed-object references can be flagged. No genuine file-content hashes currently exist in the media contract, so content-hash/perceptual duplicate claims are not made.
- Videos: genuine duration/resolution/format/processing and private processed MP4 availability. Missing stored cover frames are reported as unavailable. The current processor explicitly requires exactly three private MP4 destinations (master/customer/marketing); adding a JPEG cover would require a coordinated processor/worker contract rollout. That capability is deferred to preserve the verified deployed upload protocol.
- Readiness reuses the genuine lifecycle. Complete assistance is not approval. Approved readiness requires recorded current mandatory receipts and passing technical prerequisites; publicationPermitted remains false in this advisory API. Independent safety, category-fit and media-consistency capabilities remain held/unavailable.
- Field definitions now expose stable key, string type, required flag, text/max-length validation, existing localised label key, translated help key, category and schema version. Only the five reviewed category groups are defined; historical per-category values remain preserved.

## Measured performance

Run `node tools/measure-selling-intelligence.js`. The committed JSON contains the complete actual output. One warm-up and eight measured calls per operation, isolated PGlite; HTTP, Clerk, network and initial profile hydration excluded. CPU/RSS values describe the complete benchmark process including database startup, not a model hardware estimate.

| Products | Classification median ms | Full analysis median ms | SQL page median ms | Cached service median ms | Cache hits | Service bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 0.446 | 0.641 | 2.435 | 2.377 | 8/8 | 3601 |
| 500 | 0.22 | 2.791 | 5.622 | 3.46 | 8/8 | 5511 |
| 5000 | 0.227 | 19.207 | 31.928 | 14.866 | 8/8 | 5514 |

Process resource measurements: {"processCpuUserMs": 4400.561, "processCpuSystemMs": 510.31, "rssDeltaBytes": 553537536, "finalRssBytes": 596504576}.

The cache avoids repeated rule/media evaluation but still hashes the existing JSONB business context; both hashing and duplicate scanning remain O(n). The catalogue page still expands the authorised business array. These measurements do not establish million-business scalability or justify a disruptive catalogue migration. Future work should measure authoritative per-product revisions/projection before replacing full-profile hashing.

## Verification and outstanding acceptance

The first implementation commit passed CI baseline (1,531 tests), real-video processing/playback and the complete Selling WebKit gate. The local browser launcher is unavailable; CI supplies real browser execution. New tests cover all registry IDs, negation, conflicts/unsupported cases, incomplete fields, bounded private duplicates, image/video metadata, media relationships, hashes, private SQL caching, review persistence, stale writes, expiry, ownership and ten locales. The browser gate now exercises unsaved category assistance/vendor selection and saved analysis/review reuse after refresh, alongside the existing SQL/image/video/seven-workspace suite at eight widths in both engines.

The first deployed native-intelligence Preview was directly inspected signed out: seven links, ten languages, translated intelligence heading, Arabic RTL and the shared 2026 footer are present. No Selling-to-Marketing redirect occurred. Owner authentication is not established: the prior secure Google flow reached two-step verification and did not complete. No deployed acceptance product/media records have been written. The complete owner acceptance journey and physical iPhone/iPad Safari verification remain outstanding; authentication is not bypassed.

No third-party hosted inference, model weights, GPUs, paid model hosting, economic ledger, Customer/Marketing/Admin implementation or Production changes were introduced. Future self-hosted inference requires reviewed commercial licence/redistribution/hosting obligations, secure runtime/output-verifier design, representative hardware benchmarks and owner approval of measured operating costs. No model costs or throughput are claimed from deterministic fixture measurements.
