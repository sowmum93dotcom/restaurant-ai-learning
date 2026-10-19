# Private visual runtime connection — PR #708

The same Selling dashboard now has a prepared private GPU service connection and a persisted vendor review workflow. The model service is **not activated**. No Production deployment, new paid instance, live database write, model download or environment-secret change was made by this implementation turn.

## Implemented

- Private DEMEOS-operated warm Qwen3-VL worker and non-root supervisor, pinned local safetensors, file and code hashes, bounded byte-only protocol, authentication, HMAC, replay protection, one-job admission and actual process-group termination on deadline.
- Server-only isolated-Preview composition connected to the existing Analyse product route, authorisation and durable execution ledger. Production and real-business model execution remain rejected.
- Existing 2,000 ms execution boundary preserved, including media/transport overhead. No unmeasured deadline increase.
- Persisted per-proposal accept/edit/reject decisions with exact-result concurrency protection and immutable audit snapshots. Suggestions never edit or publish products automatically. Accepted title/description transfer explicitly into the unsaved existing editor.
- Model/code-specific analysis caching, safe failure/empty-result states, ten-language controls and responsive styling inside the existing Product Catalogue.
- Fix for semantically unchanged editor objects having a different serialized key order from SQL JSONB: visual execution now binds to the exact stored product object. No authoring revision rule was relaxed.
- Preparation, stored-model staging, checksum inspection and genuine-runtime benchmark tools. They have not been executed on the GPU in this turn.

## Local evidence

The complete Node suite passed **1,553 tests**, zero failures/skips. It includes five actual Python supervisor/HTTP cases through a Node wrapper, using a clearly labelled fake child process. Transport tests verify signing and real image bytes/hashes; SQL tests verify storage, cache reuse, stale/foreign denial, immutable review records and unchanged products/permissions/publication.

The complete existing Selling Chromium gate passed all eight widths, 375–1440. A new declared model fixture exercises suggestion UI in all ten languages at mobile/desktop widths, accept/edit/reject persistence after refresh, and copying an accepted suggestion into the editor without saving the product. Fixture output is not reported as model accuracy. New suggestion screenshots were visually inspected; a focused browser rerun validates final suggestion styling/status text.

These local results are not authenticated deployed Preview acceptance, physical Safari acceptance, or GPU performance/quality evidence. Latest-commit CI and deployment status must be checked separately.

## Exact next live step

Use the already provisioned Runpod pod and attached saved Global volume. Confirm model-copy integrity and restore the non-root private runtime from the reviewed checkout. Establish the private HTTPS route and run the genuine benchmark. The operator runbook is `tools/visual-runtime/README.md`.

Only enable branch-scoped Preview execution after the exact code/weights, network policy, isolation, benchmark and category/language acceptance have genuine review records. If two seconds cannot be met, keep execution unavailable and review measured alternatives. No Production activation is authorised.
