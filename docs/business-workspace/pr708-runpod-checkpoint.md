# Runpod checkpoint — owner-provided evidence, 18 October 2026

These results were shown in the owner's terminal and Runpod console screenshots. They are not measurements independently executed from this checkout.

- Pod: `visual_gray_ladybug` (`xm3g09qr8v4xkr`), NVIDIA L4, 23,034 MiB VRAM. Console allocation: six vCPU, 62 GB RAM, 30 GB container disk, EU-RO-1. Host-wide `free` output is not the pod's memory allocation.
- Image: `runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404`. Python 3.12.3, PyTorch 2.8.0+cu128, Git 2.43.0 and FFmpeg 6.1.1 were reported; CUDA availability was true.
- The PR branch cloned into `/root/demeos`. Cloning into `/workspace` failed because the mounted Global volume did not support Git's chmod operation.
- `/root/demeos-venv` used system site packages. Added versions: transformers 4.57.6, accelerate 1.12.0, safetensors 0.7.0 and huggingface-hub 0.36.0. This reused the image's PyTorch installation.
- `Qwen/Qwen3-VL-4B-Instruct`, snapshot `ebb281ec70b05090aa6165b016eac8ec08e71b17`, was downloaded into `/root/demeos-model`. The download used `HF_HUB_ENABLE_HF_TRANSFER=0` because the image enabled fast transfer without the `hf_transfer` package.
- Local BF16/SDPA model loading on `cuda:0` succeeded with `local_files_only=True`, `trust_remote_code=False` and safetensors. A genuine synthetic solid-red image inference returned `red`.
- That result establishes basic GPU loading and image inference only. It does not establish product recognition quality, ten-language accuracy, the existing two-second deadline, throughput, cost per analysis or readiness for customer data.
- A copy to `/workspace/demeos-model` was started. A subsequent directory listing showed all 13 expected files, totaling 6.8 GB, including both 4.7 GB and 2.2 GB weight shards. The full byte comparison did not produce a visible completion result before the browser terminal disconnected. **Integrity of the stored copy remains unverified.**
- The environment list was saved successfully to `/workspace/demeos-requirements.txt` using `pip freeze --local`. It records additions in the virtual environment, not the entire base image.
- The Volumes tab showed Global volume `dizzy_indigo_worm`, mounted at `/workspace`, about 7 GB stored. The Stop dialog separately warned that no volume was configured; this warning must not be treated as proof about the Global volume's contents.
- The final console screenshot showed the pod stopped, compute and container storage not running, and pod total $0.00/hour. This is a historical screenshot, not a current billing check. Global storage may incur separate charges.

On resumption, confirm the Global volume is attached and validate the saved model before downloading it again. `/root` contained the temporary checkout and virtual environment; do not assume they survive the stop. Use the saved environment list and matching base image if restoration is needed. Obtain the current connection details from the console rather than reusing an old SSH endpoint.

No private model service has been built or connected to Selling. Genuine product Analyse/review integration, isolation attestation and deployed owner acceptance remain unfinished. PR #708 remains draft and unmerged; Production activation is not authorised.

## Verified recovery — 19 October 2026

This section supersedes the earlier uncertainty about the stored model copy. It records direct terminal operations on the existing pod, not owner screenshots or simulated inference.

- The original L4 restart and automatic migration reported unavailable hardware. Manual GPU listings also changed to unavailable before allocation. No replacement pod was created.
- Started the existing `visual_gray_ladybug` temporarily in its CPU recovery mode, quoted at $0.30/hour. The actual cgroup v1 memory limit was 512,000,000 bytes. An initial streaming download was OOM-killed; resuming with 1 MiB writes, explicit flushing and page-cache release completed successfully. Host-wide RAM is not the container limit.
- Despite the Storage dashboard reporting zero bytes/objects, `/workspace/demeos-model` contained the original 13 files and `/workspace/demeos-requirements.txt` was present. The second shard was incomplete. No model files or volumes were deleted.
- Restored only `model-00002-of-00002.safetensors` from publisher snapshot `ebb281ec70b05090aa6165b016eac8ec08e71b17`. Its verified size is 3,908,490,048 bytes and SHA-256 is `046296a2a387efb43b0c997d5833c789604d168834f6e0d3064bf7bb13d002a6`.
- Saved the restored file on the Global volume as a separate recovery file, closed it, and read it back in full. Verified all 13 model files against the pinned publisher snapshot: LFS SHA-256 metadata for both shards, and SHA-256 of the pinned publisher bytes for the remaining files. The first shard is 4,967,229,296 bytes with SHA-256 `30a01a0556622645a3cce87b655bbbbbc1f170c196099f1b666c93202c3339a9`.
- Promoted the verified second shard to its normal filename. Preserved the original incomplete bytes at `/workspace/demeos-model/model-00002-of-00002.safetensors.incomplete-20261019`.
- Saved the publisher-derived checksum manifest at `/workspace/demeos-model-source-manifest.json`. Its exact file SHA-256 is `e2c07fc24e1523d0987dfb6b082020c0eb74a04eb622f36c153fd97c5d254ae2`. This establishes source-file integrity, not runtime security approval or inference accuracy.
- Stopped the CPU recovery pod after verification. The console confirmed compute and container storage not running, $0.00/hour pod total, and balance $33.38. Global storage can incur separate charges. The stopped recovery view lists GPU count zero; the next operator must explicitly check GPU allocation and price before starting inference rather than assume the Start button resumes the old L4 allocation.

The private service implementation is saved in commit `521f8151ee147601007fd84f96ee6e542de6e576`, but has not been installed or benchmarked on the GPU. It remains disabled. Latest-commit baseline tests and video processor CI passed; the Chromium browser job passed, while Selling WebKit failed its new visual-proposal horizontal-overflow assertion at `browser-checks/selling-dashboard-gate.js:488`. Do not describe complete browser CI, physical Safari acceptance, live GPU performance or the assignment as passed. No Production deployment, live database writes or credentials exposure occurred.

## WebKit layout correction — 19 October 2026

Reproduced the CI failure locally using Playwright 1.55.0 WebKit: Spanish catalogue filter selections widened the 375 px document to 409 px. The cause was native select text rendering, rather than the AI proposal cards. Catalogue filters now use bounded native select controls with a CSS arrow, ellipsis and right-to-left arrow placement. Selection semantics and complete option text remain available; no page-level overflow masking or assertion removal was introduced.

The unmodified `browser-checks/selling-dashboard-gate.js` passed locally in both WebKit and Chromium at all eight widths: 375, 390, 430, 761, 820, 1024, 1280 and 1440 px. This includes all ten locales, persisted proposal accept/edit/reject and explicit editor transfer, SQL catalogue operations, access checks, and real FFmpeg frame extraction/private posters/refresh/cleanup at 375 and 1440 px. Rendered mobile controls were also visually reviewed. AI proposal data in this browser gate is explicitly a fixture; this is not a live GPU inference benchmark or physical Safari acceptance. Remote CI for this correction must be checked separately.

The original pod remains stopped. Genuine model service installation, security review, latency/quality measurement and isolated deployed Preview acceptance remain incomplete; the runtime stays disabled.
