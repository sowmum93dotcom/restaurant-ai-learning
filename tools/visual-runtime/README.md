# DEMEOS private visual runtime

This service runs DEMEOS-controlled Qwen3-VL weights on the existing raw GPU. It is not an external AI inference API. The existing Selling dashboard and 171-category classification remain in place.

## Ownership and control

DEMEOS controls the application, its existing 171-category pipeline, business rules, permissions, vendor review workflow, execution contracts and operation of this service. The underlying Qwen3-VL-4B-Instruct base model was developed by Qwen; it is a licensed external model, not a foundation model trained from scratch by DEMEOS. The publisher identifies its licence as Apache-2.0. Preserve that attribution and complete the actual licence review before activation; a licence label is not an activation approval.

Model inference runs inside the account-controlled GPU container using local files. It does not call a hosted model inference API. The inherited syscall filter denies outbound network operations in the supervisor and model child. This does not make the rental provider, storage, hosting, GPU drivers or software dependencies DEMEOS-owned infrastructure. The same execution contract can be operated on compatible DEMEOS-owned hardware later, with fresh compatibility and acceptance checks.

Vendor corrections are stored review decisions. They do not automatically retrain the base model. Any future fine-tuning needs a separate authorised dataset, training process, versioned model and evaluation. The current worker proposes visual descriptions; the existing DEMEOS rules and category pipeline retain their separate responsibilities.

The requested output language is a validated `outputLocale` field in the signed
visual input, not an instruction inferred from product text. Existing callers
without this optional v2 field default to English. The Selling dashboard sends
its selected language; the service and GPU boundary accept only the existing
ten Selling locales. Language participates in both analysis and GPU cache
identity. Switching languages clears displayed suggestions and invalidates late
responses; a proposal from another language cannot be reviewed as the current
analysis. Trusted model instructions use the system role, with product text
confined to a separate untrusted user message. Advertising text is not evidence
of delivery, freshness, certification, stock, safety or price. These controls
still require genuine quality evaluation and do not certify model statements.

## What is implemented

- A warm, dedicated GPU child loads only the pinned local safetensors snapshot `ebb281ec70b05090aa6165b016eac8ec08e71b17`, with BF16, SDPA, offline Hugging Face/Transformers settings and remote model code disabled.
- A non-root supervisor accepts one job at a time and no inference queue. A job that reaches its deadline loses its whole worker process group via SIGKILL; a replacement must finish loading/warming before becoming ready. HTTP cancellation is not represented as proof of GPU cancellation.
- The service has no SQL, permanent Blob, Hugging Face or cloud-provider credentials. The model child receives only a small explicit environment allowlist. Model files, checksum manifest and service code must be read-only to the service user. An external egress firewall/network policy is still required; offline library flags are not a network firewall.
- HTTPS transport requires a server-only bearer secret plus HMAC of the entire request. Requests have unique IDs, expiry/deadline checks and replay rejection. Unauthenticated callers are rejected before their bodies are read. The service binds loopback by default. Eight connections and six MiB request size are the upper bounds.
- The Vercel-side transport fetches only authorised private media from explicitly configured hosts, verifies byte counts and SHA256, and forwards **bytes, not URLs**. No endpoint, source URL, secret or executor can be supplied by a browser request. Ownership and product/media revisions are rechecked before forwarding and before returning results.
- Maximum one image or four already extracted video frames, four MiB media total, 1,600-pixel input bounds, model preprocessing capped at 640 × 640 pixels per image, at most 256 generated tokens (within the existing 512-token ceiling), 32 KiB proposal output and the **unchanged 2,000 ms overall execution deadline**. Transfer and ledger time consume that existing deadline; the remote worker receives only the remaining time. Synchronized host clocks are required. Passing the local GPU benchmark does not establish that the complete application route meets that deadline.
- A reviewed code hash binds `contracts.py`, `server.py` and `worker.py`; the weights manifest hash binds all 13 stored files. Code/model changes invalidate analysis caches and must be reviewed again.
- Existing durable SQL budgets enforce one active business slot, 20 jobs/hour and validated cache reuse. Abandoned active slots remain unavailable until an operator reconciles them; the code does not blindly reset a possibly running GPU job after a web-function crash.

## Dashboard behavior

The existing **Analyse product** action still performs the DEMEOS-native deterministic checks. When the reviewed runtime is explicitly enabled for the authorised isolated Preview business, saved unchanged products also receive visual suggestions based on their main ready image (or the first ready image; otherwise, stored verified video frames).

The server stores model provenance and suggestions in the existing owned intelligence record. Accept, edit and reject decisions are saved with exact-result compare-and-swap protection and immutable review events in the existing visual event table. No schema migration or backfill was added. Concurrent reviews cannot silently overwrite one another. A changed product, media, stock or runtime configuration invalidates the old analysis. Equivalent editor data reuses the exact stored product record, avoiding incorrect revision failures from JSON object key ordering.

An accepted title/description can be copied into the existing editor. **The vendor must still save the product separately.** Analysis/review does not change products, prices, stock, access grants, safety checks, publication or customer visibility. Model statements remain unverified suggestions, not independent validation evidence. Category classification continues through the existing 171-category pipeline; this worker does not invent a category registry or claim verified image-based category accuracy.

All added review controls and unavailable/empty-result messages use the existing ten Selling languages and Arabic RTL layout. This is the main vendor dashboard, not a separate dashboard.

## Current activation state

**Disabled by default; Production execution is rejected even if the enable setting is present.** On 20 October 2026 the reviewed service ran genuine inference on the existing Vast RTX 4090 evaluation instance. All 13 pinned model files passed the trusted manifest checks. Five single-image and five four-frame synthetic cases passed the unchanged 2,000 ms deadline through authenticated loopback HTTP. Measured client times were 308.98–321.36 ms for one image and 470.18–479.42 ms for four frames; peak allocated model VRAM was 9,013,145,600 bytes (8.39 GiB).

These are local GPU measurements using synthetic red media, not real-product accuracy, multilingual quality, physical Safari acceptance or full application-to-GPU HTTPS latency. The service was terminated after measurement and both GPU and recovery CPU compute were stopped. Model files and evidence were retained. See the latest section of `docs/business-workspace/pr708-runpod-checkpoint.md` for provenance and restart boundaries.

Do not fill review IDs with placeholder approvals. Activation requires an actual licence/security review, trusted source verification of weights, the exact deployed code hash, a reviewed end-to-end benchmark, correct Preview database isolation, the existing owner grant, a private HTTPS route and controlled network egress. Do not extend the two-second boundary to make a benchmark pass. If it cannot pass, retain unavailable behavior and bring measured evidence for a separately reviewed asynchronous/deadline change.

## Operator preparation on the existing pod

Use current connection details and reuse `/workspace/demeos-model` rather than downloading the weights again. The source copy passed publisher-derived integrity verification on 19 October; the approved A5000 evaluation independently staged and reverified all 13 files on 20 October. See `docs/business-workspace/pr708-runpod-checkpoint.md` for the distinction between preparation, measurement and activation.

Set `DEMEOS_RUNTIME_PORT` to an unused local port. The official Runpod image already uses the default 8081 for nginx; the A5000 evaluation uses 18081. A listener bind failure must terminate the supervised worker rather than leave it using GPU memory.

1. Review source, dependencies/base image and the trusted snapshot checksums. `inspect_model.py MODEL_DIRECTORY NEW_MANIFEST_PATH` records local checksums with progress, but **cannot establish their trust or source by itself**. Compare the stored weight hashes and configuration/tokenizer files with a trusted copy of the pinned publisher snapshot. Preserve the resulting manifest as root-owned read-only input.
2. Run `sh tools/visual-runtime/prepare.sh` from the reviewed checkout. It prepares `/opt/demeos-visual-runtime`, a dedicated `demeos-ai` user, a venv reusing the image's existing PyTorch and a secret file readable only by that user. It does not start inference, a Pod or any paid infrastructure. It does not replace the base PyTorch installation. Its small primary dependency pin set is not a substitute for reviewing the complete base image and installed environment; `environment.txt` records the result.
3. If the Global volume is writable to the service user, use `stage_model.py SOURCE TRUSTED_MANIFEST NEW_LOCAL_DIRECTORY` as root. It copies existing bytes with progress, verifies their checksums and creates a root-owned read-only-to-service local model. It does not download weights or overwrite an existing destination. Keep a root-owned read-only copy of the manifest outside the writable volume too. Check the 30 GB container disk has enough space. After a Pod stop the local copy may need restoring from the Global volume.
4. Set `DEMEOS_MODEL_PATH`, `DEMEOS_WEIGHTS_MANIFEST` and `DEMEOS_RUNTIME_SECRET_FILE` to the reviewed read-only local files. Start `server.py` with the prepared venv as **demeos-ai**, not root. Expose the loopback listener through a reviewed private HTTPS proxy. An explicitly acknowledged provider TLS proxy can use `DEMEOS_RUNTIME_BIND=0.0.0.0` and `DEMEOS_RUNTIME_BEHIND_TLS_PROXY=true`; that flag does not configure TLS, firewall rules or permission by itself. Never expose the port over unencrypted public HTTP or log auth headers/request bodies.
5. Use authenticated `/healthz` to confirm the exact ready model, code and weights hashes. Health metadata is not product accuracy or performance evidence. Run `benchmark.py` against the real HTTPS route with the secret **file**, reviewed weights manifest and reviewed runtime code hash, writing a new report path. The script stops on the first failed case and never enables execution. Its optional loopback mode measures hardware only, not Vercel-to-GPU latency. Reports explicitly leave product/multilingual accuracy and activation approval false.
6. Finish the authorised-media, 171-category, ten-language, hallucination/abstention, latency and VRAM acceptance against genuine GPU output, including the actual Vercel-to-service route. Record approval evidence and enforce the existing $35/24-GPU-hour evaluation cap outside this process. **Stopping the Python service does not stop Runpod compute billing.**

Failed benchmark reports retain the HTTP status and, only for an exact known
status/code pair, a fixed runtime error code such as `execution-timeout` or
`runtime-unavailable`. The worker also reports one of four fixed HTTP 502 codes:
`model-json-invalid`, `model-output-limit` (invalid JSON after exhausting the
generation budget), `model-evidence-invalid`, or `model-output-invalid`. These
codes distinguish generation/parser failures from the supervisor's HTTP 504
deadline. The supervisor still kills and recovers the failed child; a rejection
is never a successful empty result. Unknown or extended error envelopes remain
unavailable. Arbitrary response text, headers and credentials are never
saved. The benchmark stops after its first failure; a synthetic result does not
establish product accuracy. Run its local fixture checks before paying for GPU
time: `python3 -m unittest discover -s tools/visual-runtime -p '*_test.py'`.

### Renting first, then moving to owned hardware

The runtime is independent of the GPU rental provider. Reuse this checkout and
the pinned model/manifest on a compatible Linux NVIDIA machine. This is not a
new model, category registry or dashboard. `prepare.sh` currently requires the
existing PyTorch 2.8.0+cu128 environment; a different GPU architecture or base
environment needs compatibility verification rather than an unreviewed upgrade.

Before ordering, verify actual capacity and the full evaluation cost: existing
spending, compute, setup/minimum term, disks, retained storage, transfer and tax.
The owner's current total cap remains $35, including previous charges. An
unpriced or higher-commitment dedicated rental is not authorised by that cap.
Do not create a duplicate Runpod pod or remove the existing Global volume.

Preserve the source model and incomplete-shard backup. A transfer to a selected
replacement host must copy existing files, then compare every file against the
trusted publisher-derived manifest. Local checks, historical integrity evidence
and prior synthetic inference do not establish fresh GPU acceptance. Keep the
dashboard runtime disabled and Production unchanged until acceptance passes.

Keep the secret out of chat, screenshots, Git and model requests. Configure it through the normal secure environment/secret workflow. Do not give the model worker permanent database, Blob or provider keys.

### Vercel Preview-only composition

Only after acceptance, configure branch-scoped Preview values:

- Existing isolated Preview database settings and exact test business/owner authorisation.
- `DEMEOS_VISUAL_RUNTIME_ENABLED=true`.
- `DEMEOS_VISUAL_RUNTIME_ORIGIN`: reviewed HTTPS origin, no path/query/userinfo.
- `DEMEOS_VISUAL_RUNTIME_HOST`: that exact hostname.
- `DEMEOS_VISUAL_RUNTIME_SECRET`: the secret securely matching the service secret file.
- `DEMEOS_VISUAL_MEDIA_HOSTS`: comma-separated exact private storage hosts, no wildcard.
- `DEMEOS_VISUAL_RUNTIME_MANIFEST`: JSON with `operator: "DEMEOS"`, `modelId: "Qwen3-VL-4B-Instruct"`, pinned `modelVersion`, reviewed `weightsManifestHash` and `runtimeCodeHash`, actual `licenceReviewId`, `securityReviewId`, `benchmarkReviewId`, `benchmarkTimeoutMs: 2000` and reviewed capabilities (`image-semantics` and/or `video-frame-semantics`).

Removing the enable setting disables new model execution without touching product data. Changing review/model/code metadata creates a new cache identity. No browser flag can enable the runtime, and no Production configuration is added here.

## Verification evidence

`acceptance.py` is a separate controlled-media evaluator. Its checked-in pack
uses three existing repository images in all ten Selling languages plus one
conflicting advertising/instruction case (31 requests). These are controlled
fixtures, not real-business product acceptance or independently sourced photos.
Asset checksums, image bounds and every case are preflighted before networking.
The evaluator binds replies to the request and deployed model/code hashes,
validates measurements/output, checkpoints evidence and stops on the first
execution failure. Existing reports are never overwritten. It never enables
execution or automatically marks language, product or category quality verified.
Each output retains its review rubric and pending human-review status; completing
31 HTTP requests alone is not semantic acceptance.

Validate without a GPU or any credential:

```sh
python3 tools/visual-runtime/acceptance.py \
  --pack tools/visual-runtime/acceptance-cases.json --media-root . --validate-only
```

On the operator host, use the same command without `--validate-only`, adding
`--origin`, `--secret-file`, `--weights-manifest`, `--runtime-code-hash` and a new
`--output` path. HTTP is accepted only for explicit `--local-hardware-only`
loopback measurement. This does not exercise the dashboard, its authorisation,
the 171-category pipeline or application media transfer; those need separate
isolated Preview acceptance. No runtime code or model change is made by the
evaluator. Its HTTP test responses are explicitly fixtures, not GPU evidence.

Automated coverage exercises real local SQL, HTTP authentication/replay limits, transport signing/media hashes, ownership, cache/revision checks, per-proposal persistence/audit, and process-group termination. **The subprocess and model responses in those tests are explicitly labelled fixtures, not genuine GPU inference.** The Python supervisor tests do not import Torch or download weights.

The browser gate exercises the shipped dashboard/API with fixture suggestions at mobile and desktop widths, all ten languages, accepting/editing/rejecting, reload persistence, and explicit transfer into the unsaved editor. Ordinary native analysis remains available with model execution disabled. The run summary in `docs/business-workspace/pr708-private-runtime.md` distinguishes local checks from outstanding deployed/GPU acceptance.
