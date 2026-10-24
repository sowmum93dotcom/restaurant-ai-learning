# ROOT Customer search handoff — 22 October 2026

Status: implemented in the existing PR #708 branch; signed-in Preview empty-result search and context separation verified. Native GPU acceptance is still incomplete and disabled. No merge or Production change.

## User flow and application boundary

In the independent ROOT application's Customer mode, a user enters a request, sees its canonical Customer Experience understanding, explicitly confirms sharing, and searches the existing DEMEOS catalogue. ROOT displays published matches or an honest empty result and links to the existing Customer Experience for participation, availability and ordering. It creates no parallel marketplace dashboard, search engine, registry or intelligence executor. Business mode does not expose this Customer action.

ROOT authenticates the caller and requires the Customer audience, explicit current confirmation, a supported locale and bounded supplied text. Before storage access, it verifies that the current branch, test environment and actual POSTGRES_URL host match the isolated Preview database guard; a Preview label alone is insufficient. The server constructs the confirmed understanding with the existing customer-understanding module. It delegates to api/customer/possibilities.js, which retains independent identity resolution, public-catalogue validation, customer privacy/history decisions, issuance, existing semantic interpretation, deterministic constraints and guarded ranking. The default reviewed search configuration remains unchanged; no hosted inference provider is installed.

No browser-selected tenant, business, customer identity, mode, provider, executor or category override is accepted. The delegated request has no catalogue test query and strips both controlled-demo headers. Empty real catalogues remain empty rather than becoming fictional matches. ROOT does not pass its personal workspace identity as Customer Experience authority. That application independently verifies the same caller's existing credential and continues excluding vendor owners from customer history. Existing opt-in preferences/feedback controls remain authoritative.

ROOT renders public result text with textContent, without returned tenant IDs, hidden ranking metadata or generated availability claims. Changing text, category, locale, workspace or selected saved work clears prior results and confirmation. A stale response cannot render in a different request/context. Search is explicit and does not start a GPU job or save a model result in ROOT.

## Validation so far

39 focused Node tests passed, covering the new real-handler delegation, original ROOT permissions/persistence/Selling checks, existing public catalogue, search semantics and guarded ranking. New checks demonstrate: unconfirmed/Business/foreign-authority requests never delegate; the existing handler independently resolves its customer identity; budget and unavailability constraints remove ineligible offers; public responses omit private business IDs; preference and feedback stores are not read without their controls; vendor owners do not gain customer history; empty catalogues cannot enable demo fallback; and denied/malformed/failed delegates fail closed without leaking internal details.

The existing Chromium/WebKit ROOT HTTP/browser gate now exercises the shipped UI through the real existing search handler using explicitly named catalogue/auth fixtures. It checks consent, bounded eligible matches, empty results, context invalidation and all ten interface locales at 375/820/1440 px. Fixture browser evidence is distinct from deployed sign-in, real customer data, native GPU execution and fluent human language review. Browser gate results and signed-in Preview evidence must be recorded after deployment; do not treat this document or a READY deployment as acceptance.

## Unchanged remaining work

The original-image external native path exceeded the existing two-second deadline; zero native ROOT results were saved. Paid compute was stopped with models, Global volume and reports retained. Smaller-image diagnostics and reconciliation of the single expired Preview ledger claim remain blocked by automatic approval review pending explicit approval. Separate external-account live isolation and the remaining network-wide capability journeys remain incomplete.

## Recorded deployed and CI evidence

Implementation 45d5c7bb567c2033c460a1a94ab3064bc32195ae deployed READY to Preview dpl_2V57HWXpDet6ehHTc3oB27fx26C5, target null. Actual signed-in Customer mode confirmed `black waterproof jacket under £100`; the existing service returned no published matches, the interface showed its explicit empty state, and consent reset. Switching Business hid Customer search and cleared results/consent; switching back Customer hid Selling, cleared the request and kept both result and consent empty. This proves the live empty path, not a positive published match, model execution or a different external identity. See root-customer-search-empty.jpg and root-customer-search-checkpoint.json in pr708-evidence-20261022.

The initial Chromium fixture failed because its old unscoped `blockquote` assertion matched both the evidence quote and the new confirmation quote. Commit 31909903bf96e174d3e86962756a830b7364936f scopes that assertion to #evidence blockquote. Its ROOT Chromium step and complete WebKit job subsequently passed; WebKit logged 375/820/1440 px with ten locales each (run 39850186981, jobs 120073942403 / 120073943023). Those tests use labelled auth/catalogue fixtures and are not live identity or GPU evidence.

Database-isolation guard commit ea7f4cf8cd3ff9258fc4bd5125ee902b7f57ab1d deployed READY to Preview dpl_5KqzzqKPtK5cs8GRVGBsbQQyLWjD, target null. Full Node CI passed 1,586/1,586, zero failures, run 39850855063 / job 120076284100. The video workflow 39850855067 also passed. Its browser workflow 39850855097 is still pending at this checkpoint; do not relabel predecessor browser evidence as a guarded-head run.

Local full-suite run: 1,583 passed and two failed because ffmpeg-static was absent after installing dependencies with scripts disabled. Both existing video checks passed in full CI; no application/test assertion was weakened to hide those local environment failures. The focused guarded-head checks passed 39/39. No GPU was restarted for this work.

The guarded deployment was then checked through a fresh signed-in page reload and confirmed request. It returned the same honest empty result and reset consent; model execution stayed unavailable. This guarded-head result is recorded from read-only DOM state. Screenshot captures during that later check were blank despite visible DOM geometry, so those captures are excluded from accepted visual evidence. The earlier valid root-customer-search-empty.jpg remains explicitly bound to the original search implementation; no blank capture is presented as proof.

At the subsequent provider read-back, RunPod remained stopped and Vast remained inactive. Last displayed balances were $21.21 RunPod and $23.35 Vast: $60 - $21.21 - $23.35 = $15.44 cumulative displayed deductions, including prior spending. These delayed, rounded balances are not a settled invoice; retained storage continues charging. No paid compute was started during this build turn.

Latest guarded-head browser read-back: WebKit job 120076284192 completed successfully, including the ROOT flow. Chromium job 120076284588 was still installing browser dependencies, so no latest-head Chromium/full-workflow pass is claimed. The preceding implementation’s Chromium ROOT step passed after the scoped-selector fix.
