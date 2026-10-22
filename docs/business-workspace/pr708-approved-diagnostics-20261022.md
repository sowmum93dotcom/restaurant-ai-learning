# Approved diagnostic checkpoint — 22 October 2026

The owner explicitly approved separate 320px diagnostic copies and reconciliation of one expired Preview execution claim. The approved architecture, original source images, model weights, two-second contract and application permissions remain unchanged.

## Implemented and verified

- Three separately checksummed WebP copies retain the original 31 controlled cases. `prepare_bounded_pack.py` verifies all source hashes before derivation, reads those verified bytes, and refuses to overwrite different outputs. Copies are diagnostic evidence only, not verified Selling media.
- The native HTTPS operator helper reuses the existing acceptance validator. It pins model, weights and runtime hashes, authenticates compressed wire bytes, limits responses, stops on the first failed case and never approves activation or quality.
- 34 Python fixtures passed, including source integrity, repeatability and overwrite protection. These are software checks, not GPU inference evidence.
- The exact expired Preview claim was closed with a failure result and atomic audit. The three-job count was preserved; no data was deleted, no budget reset, and no result was fabricated. See `pr708-evidence-20261022/approved-claim-reconciliation.json`.

## Native evaluation status

Existing replacement pod `lv9zznlit6bhml` was selected after existing retained allocations and Global volume compatibility were inspected. Its RTX 4090 quote is $0.89/GPU-hour plus $0.004/hour temporary disk, with original Global volume `dizzy_indigo_worm` at `/workspace`. No new pod or volume was created. At 21:36 UTC the provider still reports initialization without a connection endpoint; no new model verification or GPU inference has run on this host.

Native runtime hash remains `7368e842310e3f1cd76ba711936ed955964519c0b7b41c0ebbddcc91c44befa3`. The diagnostic files do not change server/worker/contracts. Existing earlier native loopback passes remain valid historical measurements, while their external two-second deadline failure remains unresolved.

## Acceptance still open

A fresh native HTTPS pass, ROOT application GPU execution, private saved-result retrieval and user review have not passed. An actual separate external-user account acceptance run also remains open. Preview GPU feature flags remain disabled. PR #708 stays draft and unmerged; Production is unchanged.
