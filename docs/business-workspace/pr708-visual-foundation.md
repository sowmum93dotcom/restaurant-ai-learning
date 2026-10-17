# PR 708: DEMEOS-controlled visual execution foundation

Status: code foundation and isolated verification, not a deployed visual AI system.
Base: 7fc08013d9fa6e3c6cf70bb697cf24f147303160. Keep the PR draft and unmerged.
No Production deployment, live migration, credentials change, paid infrastructure,
model weights download or external hosted inference was performed.

## User story and implementation

The existing Selling Product Catalogue and Images & Videos UI calls the existing
Selling API, which checks Clerk identity and persisted business ownership, reads
private SQL/media state, runs native deterministic analysis and renders findings.
The vendor chooses changes in the existing editor and saves through the existing
revision-guarded authoring path. Publication remains separately authorised.

Authoritative category logic remains `marketing-agent-categories.js`,
`customer-category-classification.js` and `data/marketing-agent/categories-v1.json`:
nine sectors, 171 categories. Their code and negation rules were not changed.

Changed/added modules:

- `api/_lib/selling-model-boundary.js`: preserves v1 exports and disabled default;
  adds v2 strict image/sampled-frame schemas and a server-composed execution
  adapter. No HTTP endpoint/client, model loader or request-selected runtime.
- `api/_lib/selling-model-ledger.js` and additive tables in `database.js`: SQL
  per-business active slot, atomic hourly job budget, last-result reuse and
  immutable terminal execution events. These are not connected to a live model.
- `api/_lib/selling-visual-readiness.js`: metadata, aspect ratio, versioned media
  revision, bounded four-frame sampling plan and a current-SQL-state authorizer.
  Video frame execution is deliberately rejected until genuine frames exist.
- `media-sharp-driver.js`, `media-processor.js`, `media-processing-result.js`,
  `media-asset-contract.js`: SHA256 from actual decoded source bytes, plus hash
  and byte count of the actual optimized master image. Strict normalization
  preserves these through processing and SQL. Older unhashed assets still work.
- `selling-native-intelligence.js`: v2 invalidation, exact source-hash duplicate
  findings where evidence exists, structured media technical details. No fake
  hashes for old media, embeddings, object labels or semantic video summaries.
- `selling-media.js`: builds product/order maps once instead of repeatedly
  scanning the entire catalogue while filtering, sorting and presenting media.
- `selling-product-projection.js`: isolated-Preview-only migration/backfill/read/
  rollback preparation. Not imported by any live route or default schema setup.
- Existing CSS/JS/HTML: compact upload layout and media cards; consistent action
  groups; secondary actions in navy; removal action in muted red; gold retained
  for primary submit actions. Minimum 44px media touch targets. No workspace
  removed or added. Explicit unavailable-model status translated in ten locales.

## Model execution and vendor proposals

The factory needs a server-owned manifest (DEMEOS operator, model ID/version,
licence review ID, security review ID, supported capabilities), reviewed runtime,
authorizer and durable ledger. An endpoint in a request cannot activate it.
The production application still uses the disabled default: no model configured.

v2 inputs contain exact business/product IDs, product/media revisions, bounded
image/frame metadata, content hashes and untrusted product text. They cannot
carry private delivery URLs, arbitrary options, tools, credentials or SQL.
A future trusted runtime must resolve only the authorised private object, verify
its bytes against the declared hash/size, and apply its own hard CPU/GPU/memory/
network sandbox. That runtime is an external dependency, not implemented here.

Limits: 2-second overall execution deadline, at most two calls for explicitly
transient failures, 32 KiB JSON input/output, 4 MiB total media, one image or at
most four sampled frames, 1600px maximum dimension and 512 output tokens.
The runtime must enforce token/memory/compute budgets before generating a result.
The boundary enforces scope, metadata, deadline and returned output size/schema.
A compatible runtime must be measured inside these limits before activation;
otherwise a separately reviewed contract change is required.

SQL admits one active job per business and at most 20 jobs/hour (at most 40
invocations with retries). Another adapter process cannot claim an active slot.
The adapter also permits only one outstanding runtime call in its process.
A runtime ignoring AbortSignal keeps the adapter busy and its SQL slot active.
There is intentionally no automatic lease expiry that could overlap runaway
work. Operator reconciliation must confirm termination before releasing a claim.
A process crash can therefore require reconciliation; no background job runner
or reconciliation UI is claimed. Execution event retention needs an operations
policy before activation.

A successful output means schema-valid, unverified suggestions. It includes model
and review provenance, scope/revisions, evidence hashes, timestamp and metrics.
Allowed proposal kinds: title, description, category, observable attribute,
image description, video summary, media consistency, visible product, quality.
Category values must reference the existing registry. Confidence must be null
in this contract: no unsupported probability estimates. Unknown keys and
privileged changes such as prices, stock, SQL, tools or publication are rejected.

`reviewProposal` supports accept/edit/reject with actor, business/product scope
and exact product revision. It returns review data only. It never mutates the
catalogue. There are no live model proposals to review or save in this release,
so no nonfunctional model review controls were added. Existing deterministic
category selection and saved finding review remain available in the catalogue.
Before enabling model suggestions, wire persistence/review to the existing
editor/save/audit path and recheck authorisation on every request.

Metrics include duration, calls/retries, input/output bytes, terminal error codes
and cache hits. Estimated compute milliseconds are wall-time accounting, not
measured GPU occupancy or money. Rules and the native result cache remain the
first analysis path. No job runs on refresh. Model cache keys bind contract,
model manifest, complete input and product/media revisions; reuse expires after
one hour and requires fresh authorisation. Native result expiry remains intact.

## Video protocol decision

The processor in `tools/video-processor/processor.js` accepts exactly three
unique MP4 destinations: master/customer/marketing. The worker generates these
three capabilities, verifies each private output, and the derivative normalizer
requires video content types and duration for video assets. The native FFmpeg
wrapper and HTTP driver share this contract.

Changing just FFmpeg to return an image would break this chain. This PR retains
all those modules unchanged. The real MOV-to-MP4 verification covers 3-second
H.264/AAC and 60-second silent sources, three stored outputs, SQL ready/link,
permissions and browser playback. No video cover extraction or semantic video
analysis is claimed.

The additive sampling plan records source asset, bounded timestamps, maximum
four frames, 640px dimensions and 256 KiB/frame; its status is extraction-required.
It creates no objects and therefore introduces no new orphaned cover files.
A future protocol v2 must coordinate capability negotiation, frame-image
normalization, upload/read permissions, output verification, product/video/
revision linkage, deletion/replacement/retry cleanup and legacy v1 compatibility.
Until that complete chain passes, the upload/playback protocol stays unchanged.
A frame cannot substitute for independent full-video content safety.

## Product persistence and measurements

`pr708-visual-performance.json` is reproducible with
`node tools/measure-selling-visual-foundation.js`: PGlite 0.5.8, fixture sizes
50/500/5000, one warm-up and eight measured calls. All test writes were isolated
embedded SQL. Numbers exclude Clerk, network, Neon hardware and concurrency.
Maximum observed time is not labelled p95. Updates repeat a controlled value.

At 5000 products (median milliseconds):

| Operation | ms |
| --- | ---: |
| Authoritative full-profile hydration | 12.416 |
| JSONB product lookup | 1.881 |
| Existing JSONB profile update | 21.492 |
| Existing SQL catalogue page | 28.619 |
| Deterministic duplicate scan | 1.524 |
| Product revision check (in-memory product) | 0.003 |
| SQL owner lookup | 0.490 |
| Analysis lookup by indexed key (cache miss) | 0.571 |
| Prepared projection product lookup | 0.428 |
| Prepared projection page | 0.598 |
| JSONB update plus projection trigger | 53.289 |

The projection provides indexed product reads, but a naive sync trigger adds
write cost. It is not a replacement for product-level authoring. It has NOT been
activated in deployed Preview or Production. No million-business scale claim.
Current profile hydration, profile hashing/updates and duplicate scans remain
linear. The existing media product-association index and analysis primary key
remain in use; do not add redundant indexes to those lookups.

Prepared migration safety:

1. `installProjection` rejects Production and requires the exact isolated Preview
   branch and database-host checks. It installs a derived table and transactional
   sync trigger only when explicitly invoked. There is no automatic backfill.
2. `backfillBusiness` locks one business per transaction, copies exact product
   JSON including revisions/submission/audit, and leaves the source unchanged.
   Schedule small batches outside request paths. Check row counts/hashes first.
3. The compatibility plan leaves all existing routes reading authoritative JSONB.
   Projection readers enforce SQL ownership. No dual-write authoring is enabled.
   Before any read cutover, compare every projected row to source and include
   category/stock/filter/snapshot semantics, including owner revocation tests.
4. `rollbackProjection` removes only derived trigger/function/table in isolated
   Preview. Authoritative catalogue/audits/revisions never depend on the projection.
5. A later migration should introduce per-product revision-guarded writes and
   audit transactions, then measure realistic concurrent workloads on an isolated
   Neon branch before requesting Production migration approval.

## Self-hosted model readiness (sources checked 2026-10-17)

No weights were downloaded. These are candidates for evaluation, not certified
fits for DEMEOS. No published benchmark establishes accuracy over our 171
categories or all ten vendor languages. Model original IP remains its licensors'.

| Candidate | Evidence and conditions | Hardware and quantization planning | DEMEOS evaluation |
| --- | --- | --- | --- |
| Qwen/Qwen3-VL-4B-Instruct | Publisher model card identifies 4B/BF16 and Apache-2.0; image/video/text generation and multilingual OCR. Pin a snapshot, verify licence/notice files and dependency rights before downloading. | Approximate weights-only BF16 arithmetic: 8 GB. Budget 16–24 GB GPU VRAM, 32 GB host RAM, batch one and bounded context as a planning estimate, not a measured requirement. Official family offers FP8; compatible 4-bit implementations need separate integrity/licence/quality checks. CPU/offload is an evaluation possibility, not an accepted service target. | Initial preferred evaluation candidate for multilingual images, attributes, category candidates, image-text consistency and draft descriptions; bounded frames later. Restrict categories to our registry and measure hallucinations/abstentions; no tool execution. |
| HuggingFaceTB/SmolVLM2-2.2B-Instruct | Publisher identifies Apache-2.0, English and image/video-to-text support. Its small size makes a useful comparison for bounded descriptions/frame interpretation, not proof of category accuracy. | Approximate BF16 weights-only arithmetic: 4.4 GB; plan an 8–16 GB GPU and 16–32 GB host RAM pending measurement. Test 8/4-bit only with a compatible verified runtime; CPU feasibility/latency unmeasured. | Lower-resource English evaluation baseline. Do not promise ten-language product output. Evaluate the same image/attribute/category/consistency tasks using structured schemas. |

Sources: [Qwen publisher card](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct),
[SmolVLM2 publisher card](https://huggingface.co/HuggingFaceTB/SmolVLM2-2.2B-Instruct),
[Apache 2.0 terms](https://www.apache.org/licenses/LICENSE-2.0).
Apache 2.0 permits commercial use subject to its conditions; preserve applicable
licence/notice/attribution and modification notices, observe patent/termination
terms and no trademark grant. Metadata alone is not completed deployment review.

Neither candidate has measured DEMEOS latency here. For evaluation scheduling
only, allow a broad 1–15 seconds/image or 5–60 seconds/four frames on a single
suitable GPU with short output; these are assumptions, not results or an SLA.
Cold start and CPU-only operation may be materially slower. Record warmed p50/
p95, peak VRAM/RAM, bytes, failures and cost per accepted vendor correction.
Neither candidate is authorised for execution under the 2-second contract until
measurements demonstrate compliance or a reviewed new contract is approved.

Deploy only a pinned, vulnerability-reviewed runtime with no remote-code loading,
no model tools, restricted egress, nonroot process, read-only weights, temporary
scoped media access, private logs and no storage/database secrets in the model
process. Treat image text/metadata/descriptions as hostile data; output never
becomes privileged instructions. Keep independent safety/publication checks.

## Infrastructure and cost assumptions

Recommended next step: local/offline evaluation of the two candidates, then a
separately approved private DEMEOS-operated GPU service. One reusable visual
model with a few bounded capabilities can serve the registry; no model/category.
No service was ordered or activated.

[Runpod's published pricing](https://www.runpod.io/pricing) lists an A5000 24 GB
Pod at USD 0.27/hour and L4 24 GB at USD 0.59/hour when checked. These are price
references, not availability, locality or compliance assurances. At 730 hours,
GPU-only arithmetic is USD 197.10 or USD 430.70/month; 40 hours on the former is
USD 10.80. Excludes idle loading, storage, transfer, tax, operations and backups.
Use infrastructure under DEMEOS account/control; do not use hosted model APIs.
Validate region, privacy, commercial terms and a fixed spend ceiling first.
Cost/job = billed GPU seconds * hourly price / 3600 plus other measured costs;
no monetary savings or transaction-volume break-even has been demonstrated.

## Verification and remaining acceptance

Automated and browser results are recorded in `pr708-visual-verification.md`.
Physical Safari/iPhone/iPad acceptance is not claimed. Deployed authentication
and Preview-versus-Production database isolation must be verified before any
owner-session test writes. No authenticated deployed test writes were performed.

Remaining dependencies: owner authentication; physical-device acceptance;
reviewed runtime/model snapshot/licence/security and hardware budget; independent
content safety; coordinated video protocol v2 with lifecycle cleanup; product-level
authoring migration and realistic concurrent Neon measurements; durable job
reconciliation and event retention; persisted model-proposal review before enablement.

Next Selling task: implement and prove protocol-v2 private video covers and their
replacement/deletion lifecycle while retaining v1 uploads. Keep model deployment
disabled until its separate evaluation and infrastructure approval are complete.
