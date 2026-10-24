# ROOT request recovery and saved-result composition

Development and Preview only. ROOT native acceptance remains incomplete.

## Changes

- Changing personal context, language, session, supplied text or selected Selling product invalidates the old browser request and clears GPU consent and connection status. GPU/preflight controls are restored instead of remaining disabled by a stale request.
- A token that resolves after invalidation cannot start the old request. Active browser fetches are aborted; stale responses remain blocked by the existing sequence checks. This does not assert cancellation of an execution or transaction already accepted by the server. Server ownership, deadlines, durable budgets and audit remain authoritative.
- Added a browser regression for a delayed Business token followed by Customer selection, alongside the existing responsive, language and consent checks.
- Added a real PGlite composition check for visual-result save, retrieval, accept/correct/reject and immutable original evidence. Other principals and Customer contexts cannot retrieve or review Business work. Stale reviews conflict; failed execution creates no saved success. The model executor in this check is explicitly a fixture, not native inference evidence.

## Verified locally

`node --test test/root-*.test.js`: 23 passed, zero failed. Two client race checks execute the shipped script against a minimal DOM; they do not verify layout. JavaScript syntax and whitespace checks passed.

Earlier UX commit `8799340d5a8fdfd5f8176b3663f42db54fc10f04` passed baseline CI run 39861219408. Its browser and video workflows were still running when inspected; this does not establish the new changes' CI status. Local browser executables remain unavailable and their downloads returned invalid archives. No new iPhone/iPad visual pass is claimed.

## Fresh provider observation

RunPod's authenticated Pods page showed eight rows, all at $0.00/hour, and balance $20.90. Existing L40 `hv0517pk3fgfhu` displays a Start quote of $0.82/hour; this is not proof of available capacity. Its Volumes view confirms original Global volume `dizzy_indigo_worm`, mounted at `/workspace`, 13 GB and 225 objects. No paid resource was started or created, and storage was not changed.

The Vast Instances page is signed out, so its retained instance, current charges and the complete cumulative spend cannot be freshly verified in this session. Do not restart compute based only on the RunPod balance. The approved ceilings remain $100 cumulative and $2.50/GPU-hour. Fresh billing verification, available hardware, pinned-file verification, native HTTPS deadline acceptance and genuine private ROOT save/reload/review remain open.

No runtime flags, schema, Production configuration or merge changed.
