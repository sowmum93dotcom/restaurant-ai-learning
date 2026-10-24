# PR 708: real media execution and Preview acceptance

Continuation from 861cf938e7ba46276d88f258c044fba83d96acb8, 2026-10-17.
Keep PR 708 open in draft. No Production merge/deployment, Production database
writes, credentials changes, hosted inference, model download or GPU purchase.

## What executes

The existing native FFmpeg driver now exposes a separate, versioned `frames`
operation. The original inspect/transcode and three private MP4 destinations are
unchanged. The optional HTTP processor driver does not advertise frame support;
legacy deployments keep working. The native driver remains Preview-only.

An owner explicitly selects Extract video frames in Images & Videos for a ready,
linked product video. Four mid-interval frames are sampled across its actual
probed duration (at most 60 seconds). Each JPEG is decoded/verified, at most
640x640 and 256 KiB. Frames have actual SHA256 hashes, sizes, dimensions, source
MP4 hash, timestamps, source asset/revision and the limitation
`four-sampled-frames-not-full-video`. They are stored privately under the existing
business/video prefix. Signed reads display thumbnails and the first-frame
poster after refresh. The interface says four frames do not represent the full
video. All four new messages have ten translations, including Arabic RTL.

This is real media processing, not semantic image/video understanding. No model
produced any labels, attributes, descriptions or category suggestions in this
stage. Existing deterministic category/product/image checks remain available.
The 171-category registry, classification/negation code and seven workspaces
are unchanged. Existing vendor-reviewed findings/editor/save/publication rules
remain authoritative. No model review controls are shown without real results.

## Jobs, limits, cleanup and security

`selling-video-frames.js`, `persistence.js` and additive frame job/event tables
provide one active frame/cleanup operation per business, exact profile and asset
CAS, ownership checks, unique lease fencing, at most three extraction attempts,
cache reuse for unchanged source revisions and immutable completion/failure/
expiration/deletion events. Metrics record wall time, bytes, frame count and zero
model invocations. A refresh never launches extraction.

Native FFmpeg has bounded subprocesses (3 seconds/frame), a bounded download and
short-lived private source capability; the Function itself has its existing
60-second limit. A native claim older than five minutes can be recovered, well
after those deadlines. An expired lease cannot save or release a newer claim.
This recovery rule is specific to native FFmpeg; it is NOT permission to expire
unbounded model processes. Existing model-ledger termination requirements remain.
Temporary files are removed in finally. Frame upload bodies have 8-second
individual deadlines and are verified by storage metadata before SQL ready.

Removal/product deletion acquire a cleanup lease before deleting deterministic
frame paths. Active extraction prevents deletion; a failed cleanup blocks asset
removal and remains retryable. Expired work can be reconciled and all four known
paths removed even if the Function died between upload and SQL save. Retry
rewrites those same four paths, avoiding new orphan names. Blob deletion is
restricted to these four derived JPEG path shapes; original image/video and
three-MP4 storage contracts are unchanged. Old archived records need no backfill.
There is no scheduled orphan sweep; reconciliation happens on explicit retry or
removal, and a failed cleanup requires that action or operator follow-up.

The existing visual authorizer now accepts only stored, validated frames from
one owned, linked, ready video, with current product/media revisions and exact
hash/index/time/dimension/size evidence. It does not activate a runtime. Private
media is never transmitted to an external inference service. FFmpeg children
retain their minimal environment and cannot access SQL/storage credentials.

## Safer product persistence preparation

The previous naive JSONB projection trigger remains off the live path. The
successor in the EXISTING `selling-product-projection.js` uses isolated-Preview-
only product records, per-product CAS revisions, immutable product audits and an
indexed product name. It is not imported by any live route or default schema
setup. No deployed backfill/migration or authoring cutover was run.

Backfill checks SQL owner, locks one business, preserves exact product JSON
(including audit, variants, stock/media/submission fields), batches the copy and
records the legacy source timestamp. Repeat backfill is rejected to avoid
clobbering product-level edits. Per-product writes acquire a parent SHARE lock,
check ownership/source stamp, lock only that product, validate expected revision
and atomically write its audit. No full-profile read/write or sync trigger is
used. Concurrent create uses conditional ON CONFLICT. A legacy profile update
invalidates staged reads/writes rather than silently overwriting either source.

Compatibility: live routes continue using JSONB. To adopt later, first reconcile
all hashes and stock/media references on an isolated Neon branch, exercise real
concurrent transactions, route every existing domain validator through the new
primitive, and choose a single authoring owner at cutover. The primitive itself
is not a product validator or publication authority. Retain previous revisions
and immutable audit, add bounded pagination/filter/stock snapshot compatibility,
and run all upload/order/variant regression gates before enabling reads/writes.
Rollback before adoption is simply leaving staged tables unused: original
profiles remain byte-equivalent. After experimental edits, export/replay their
audits under domain validation before any cutover/rollback; do not discard them
or copy the old profile over them. No Production migration is authorised here.

Reproduce: `node tools/measure-selling-visual-foundation.js`.
`pr708-product-record-performance.json` records actual isolated PGlite 0.5.8 SQL,
one warm-up/eight measured calls, no Clerk/Neon/network or concurrent workload.
Median milliseconds:

| Products | Existing JSONB write | JSONB + naive trigger | Product CAS + audit | Owned record lookup | Indexed record page |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | 0.694 | 1.222 | 1.889 | 0.599 | 0.916 |
| 500 | 2.595 | 6.547 | 1.892 | 0.544 | 1.544 |
| 5000 | 25.332 | 56.598 | 2.223 | 0.585 | 4.930 |

This demonstrates a promising bounded write path, not a live speedup or global
scale guarantee. Small catalogues pay transaction/audit overhead. Remaining
profile hydration and duplicate scanning still scale linearly. The JSON contains
lookup, pagination, duplicate detection, revision, ownership and analysis-cache
measurements as well. Max timings are not p95s.

## Model selection and approval needed

No existing authorised model endpoint or GPU runtime was identified in the
available Vercel configuration. Local ephemeral tooling has no detected GPU and
is not a DEMEOS-operated inference deployment. No weights were downloaded.

Preferred evaluation candidate: **Qwen/Qwen3-VL-4B-Instruct**, publisher's Apache
2.0 model card, 4B parameters/BF16, image/video-to-text. Model family evidence
supports evaluating visible products, observable attributes, image/text mismatch
and draft descriptions; it does not establish accuracy over our 171 categories
or ten languages. Restrict category outputs to the existing registry, require
evidence and vendor review, and permit abstention. Model IP remains its licensors'.
Apache conditions include licence/notice and modification notices, patent terms
and no trademark licence. Pin and review the exact safetensors snapshot, model
configuration, dependencies and runtime image before authorising a download;
never enable remote model code, arbitrary tools or network-fetching model inputs.

Alternative **SmolVLM2-2.2B-Instruct** remains a smaller Apache-2.0 English
image/video baseline (see previous comparison). It is not accepted as a ten-
language replacement. Neither has a measured DEMEOS inference result.

Concrete proposal, NOT purchased: a DEMEOS-owned raw GPU instance running a
private authenticated service, **one NVIDIA L4 24 GB VRAM, 12 vCPU, 50 GB RAM,
50 GB persistent volume**, batch one, pinned BF16 Qwen3-VL-4B, bounded context,
one image or these four frames and at most 512 output tokens. Approximately
8 GB of BF16 weights is arithmetic only; activations/KV/runtime need measured
headroom. FP8/4-bit alternatives require separate integrity/quality checks.
No CPU latency claim is made. Disable external runtime egress after installation;
no SQL credentials or permanent Blob keys in the model container. Use the
existing boundary/ledger plus a reviewed queue/termination mechanism before
connecting a remotely executing job. The current two-second boundary deadline
must be demonstrated or explicitly revised with measured evidence; do not
silently extend it or pretend 512-token generation fits.

Runpod's public list checked 2026-10-17 lists L4 at **$0.59/GPU-hour** and 50 GB
RAM/12 vCPU; 24 evaluation GPU-hours = **$14.16** compute. A 50 GB volume is
approximately $5/month while running or $10/month stopped at the posted rates.
Allow a **maximum $35 evaluation budget**, at most 24 running GPU-hours with
operator-enforced shutdown; confirm region, availability, storage/network,
taxes and final quote fit that cap before provisioning. This is rented hardware
under DEMEOS operation, not a hosted inference API. No vendor/account/region or
processing-policy approval is implied. An alternative A5000 lists $0.27/hour,
24 GB VRAM but only 25 GB host RAM; do not assume it meets the planned RAM budget.

Actual model latency, peak VRAM, accuracy and cost/analysis remain UNKNOWN.
Compute-only cost formula is $0.59 * measured GPU-seconds / 3600, plus allocated
idle/startup/storage/network costs. No fabricated benchmark or savings claim.
Approval required: provider/account/region and data policy, the $35/24-hour cap,
exact model snapshot/licence/security review and private runtime configuration.
Then benchmark authorised media, measure hallucinations/abstentions/mismatches,
category validity, all ten languages, P50/P95 latency, VRAM and billed usage before
making Analyse operational. Full-video safety/publication remain independent.

Primary evidence checked 2026-10-17:
- https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct
- https://huggingface.co/HuggingFaceTB/SmolVLM2-2.2B-Instruct
- https://www.apache.org/licenses/LICENSE-2.0
- https://www.runpod.io/pricing

## Isolation and deployed acceptance

Neon inventory identifies `demeos-pr708-selling-preview` / `br-flat-snow-zatzl87u`
with endpoint `ep-fragrant-cake-za2a226e`, separate from main
`br-rapid-feather-zaz3jzoa` / `ep-lucky-sea-zak6kfvx`. Branch-specific Vercel
POSTGRES_HOST and the server Preview guard match the Preview endpoint;
Production POSTGRES_HOST matches main. This verifies configured separation.
Sensitive effective POSTGRES_URL cannot be read through the connector; metadata
alone does not prove the running Function uses that host. No live SQL test
writes/migrations were performed while this remains unresolved.

New `GET /api/businesses?resource=selling-isolation&businessId=<authorised-test-id>`
is routed BEFORE database code. It requires genuine Clerk identity and the exact
server test grant, works only in Preview, checks effective POSTGRES_URL against
the existing isolation guard and returns only a normalized host SHA256 fingerprint,
commit and databaseAccessed:false. Production returns 404, unauthenticated 401,
foreign grant 403, mismatched environment 409. It performs no SQL initialisation.
Compare the fingerprint with the authorised Neon inventory before test writes.
It attests environment host configuration, not a successful database connection
or user permission to any Production resource. No credentials are logged.

Authenticated deployed results and final immutable Preview URL are recorded in
`pr708-real-execution-verification.md` after final deployment checks.
