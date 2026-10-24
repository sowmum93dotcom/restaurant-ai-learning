# PR708 GPU recovery — 24 October 2026 (UK)

Continued from application source `8b10e967bddebf82557c77754c4a3e26e0bb96ad`. Draft and Preview only; no Production deployment or merge. This record is genuine hardware evidence, not completed HTTPS or signed-in native acceptance.

## Actual recovery

Existing L40S resources `m0ax08onzeyhch` and `8ayyoy3at04ytw` each returned RunPod's explicit GPU-unavailable dialogue on one restart request. Cancelled each with Do nothing. No CPU fallback or automatic migration.

Using the owner's later $100 cumulative / $2.50-per-GPU-hour approval, deployed exactly one necessary replacement: **demeos-root-gpu-recovery / 0a6tvk556l6gyj**, EU-NL-1, one L40S, 125 GB RAM, 32 vCPU, 50 GB temporary disk, official `runpod/pytorch:1.4.1-cu1281-torch280-ubuntu2404`. GPU $1.09/hour plus disk $0.007/hour; checkout rounds total to $1.10/hour. All older allocations remained stopped. Original Global volume `dizzy_indigo_worm / cmvcuubvp000007l59ohq62xx` mounted at /workspace. No model download, credit purchase, Jupyter activation or second replacement.

Actual nvidia-smi: NVIDIA L40S, **46,068 MiB**, driver 595.91.07. Existing PyTorch **2.8.0+cu128**, CUDA available. Restored exact application source from GitHub. Original weights, incomplete-shard backup and earlier reports remained on the volume.

## Verified native result

Original trusted manifest SHA-256: `e2c07fc24e1523d0987dfb6b082020c0eb74a04eb622f36c153fd97c5d254ae2`. Stage helper verified the original 13 model files into root-owned local /opt/demeos-model; source files were not overwritten. Started the reviewed offline supervisor and worker as demeos-ai, with read-only model/code checks and outbound-network denial.

Exact runtime: `ee970cec4ba2996bdc6c2c11d0ce4cab849043f89cf78b18e6f2d5bbb289853d`.

Existing benchmark.py with --local-hardware-only completed **10/10** genuine native cases: five single-image and five four-frame requests, unchanged 2,000 ms deadline. Client timing **235.580–823.113 ms**. Route is explicitly **loopback-hardware-only**. These synthetic red-media cases do not establish product/language quality, external HTTPS latency, the 31-case visual pack, twelve text cases or browser-to-SQL acceptance.

Raw report SHA-256: `e50a3f69d33147a590cf15497806429fa223e8b007de1795993999a7db3916ee`. Independently compared original and persistent-backup hashes; both matched. Report, log, preparation log, server log and summary saved to:

`/workspace/demeos-evaluation-20261024/0a6tvk556l6gyj/`

Also saved a prepared-runtime archive **excluding secrets**, plus source-8b10e967.tar.gz, to avoid repeating dependency installation/source downloads. Source model files remain separate and unchanged. Called sync before shutdown.

## Preview and security boundaries

All three workflows for 8b10e967 completed successfully:
- Baseline: https://github.com/sowmum93dotcom/restaurant-ai-learning/actions/runs/40036261366
- Video: https://github.com/sowmum93dotcom/restaurant-ai-learning/actions/runs/40036261363
- Browser: https://github.com/sowmum93dotcom/restaurant-ai-learning/actions/runs/40036261417

Vercel variable readback confirms exact PR branch, test data environment, branch PGHOST equals its database guard and differs from actual Production POSTGRES_HOST. Both existing visual flags remain false. ROOT text flag/manifest remain absent. Existing visual manifest still pins the historical worker; it was not silently repointed. No SQL operation, native flag activation, Vercel secret update or new deployment occurred in this recovery.

Prepared Edit Pod with HTTP port **18081**, TCP **22** unchanged and UDP disabled, but **cancelled without saving**. Creating this new public provider HTTPS endpoint requires confirmation at action time under browser security rules. It is not covered merely by the spending approval. The intended route must reject unauthenticated requests, require the existing bearer-plus-HMAC protocol, use a new per-run credential only in the exact PR708 Preview and GPU service, and be removed/revoked after testing. No raw public TCP inference port is proposed.

See [prepared endpoint screenshot](pr708-evidence-20261024/https-port-prepared.jpg). Provider warns that editing a running pod resets temporary container storage; reproducible runtime and evidence were backed up first. The Global volume must remain attached and be reverified after restart. No HTTP inference port was exposed in this run.

## Cleanup verified

Browser control briefly became unavailable during cleanup, then recovered. Did not claim shutdown during the interruption. Subsequently confirmed:
- Non-root supervisor/worker terminated; process query returned headers only.
- Per-run local service credential rotated after termination.
- Temporary web console switch off and Stopped.
- Provider compute and container storage **Not running**, total **$0.00/hour**.
- Original Global volume still attached.

Final displayed balance **$7.71**, compared with $7.80 before this run. Billing is delayed; this is not an exact cost or invoice. Retained Global storage billing remains separate. No credit top-up is required by this readback. See [stopped compute](pr708-evidence-20261024/gpu-stopped.jpg).

Next dependent action: obtain confirmation for the exact authenticated HTTPS endpoint on this same replacement and its matching branch-only credential; configure while stopped, restore prepared runtime, reverify all hashes, rerun 31 visual and 12 text cases over signed HTTPS, then complete actual signed-in ROOT private save/reload/correction/rejection. Do not create another pod to continue. Do not enable ordinary-user native execution or declare ROOT complete.
