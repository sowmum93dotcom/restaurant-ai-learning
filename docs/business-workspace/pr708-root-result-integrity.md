# ROOT saved-result integrity and review

Development/Preview only. Native ROOT acceptance remains incomplete.

## Implementation

Saved-work idempotency now binds to the entire original evidence payload, including engine, model proposals and provenance. Only the per-attempt request UUID and mutable persistence/review metadata are excluded. Same-evidence retries still reuse the saved work. A changed model, weights provenance or suggestion under the same request key conflicts instead of silently reusing a different result. Native save conflicts return HTTP 409; existing denial, invalid input and quota statuses are preserved. No schema migration or data rewrite is needed.

The review workspace now displays pending/accepted/corrected/rejected state in all ten existing locales. Reopening native work starts a correction from the saved suggestions, rather than the original product description; an existing owner correction takes precedence. Original supplied text and suggestions remain separate and unchanged. The evidence display consistently labels model suggestions unverified, including after acceptance. A review records the user's decision and does not become independent fact verification or a product write.

## Verification

24 ROOT checks passed locally, including real PGlite save conflicts for changed engine, suggestion and weights provenance; SQL review isolation and immutable originals; shipped-client reopening across all four review states; and existing delayed-token/preflight recovery. JavaScript syntax and whitespace checks passed. The browser gate now asserts accepted/corrected states, but no local rendered pass is claimed because browser executables remain unavailable.

Preceding commit f79f4bf117b61cb7ef35ca185f75dc19640d5785 passed baseline CI 39861779679. Its browser/video jobs were still running when inspected. That result is not claimed for this later change.

## Current GPU and billing evidence

The existing Vast session finished loading authenticated. This supersedes the previous transient signed-out observation; no new sign-in or permission grant was required. Existing instance 56929706 is Inactive with retained 80 GB disk, storage rate $0.017/hour. Vast billing shows sole $25 credit, $23.33 remaining and $1.67 usage, with delayed reporting.

RunPod billing shows sole $35 reload, $20.90 remaining and $0.000/hour current compute spend. Balance-derived total deductions across providers are approximately $15.77. RunPod's billing explorer is one hour behind; these figures are not a final invoice. Retained storage continues to charge. Approved ceilings remain $100 cumulative and $2.50/GPU-hour.

After those checks, one restart request was made for existing L40 hv0517pk3fgfhu at its displayed $0.82/hour quote. It did not visibly transition to running; Details still showed compute/container Not running and total $0/hour. No connection endpoint or new inference was established. A subsequent complete Pods inventory independently showed all eight rows at $0.00/hour. The exact reason for this non-transition was not surfaced, so no new host-failure diagnosis is asserted. Original Global volume dizzy_indigo_worm remains attached at /workspace; its prior Volumes observation showed 13 GB and 225 objects.

No resource, volume, weight download, new payment, execution flag, Production deployment or merge was created by this work. Available existing compute and genuine native HTTPS -> private ROOT save/reload/review acceptance remain open. Do not substitute fixture results for this acceptance.
