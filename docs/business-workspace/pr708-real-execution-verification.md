# PR 708 verification: real frame execution

Tested implementation: `3bd6e825ea4bf6c287c55061353b7bdb22977e06`.
This report is a subsequent documentation-only commit; it changes no runtime code.
PR remains draft/open/unmerged. No Production release or database test writes.

| Check | Verified outcome |
| --- | --- |
| Local complete baseline | `npm test`: 1547 passed, zero failed/skipped, 40.149 seconds. |
| Real frame and staged persistence tests | Five focused tests passed, including actual FFmpeg/private SQL frames, content hashes, exact MP4 preservation, ownership, cache/dedup, source provenance, cleanup, stale lease fencing, expired native recovery, three-attempt cap, product CAS/audit and stale legacy source rejection. |
| Local Chromium Selling gate | All eight widths 375/390/430/761/820/1024/1280/1440 passed. Real four-frame UI, thumbnails/poster, refresh, ten locales/Arabic RTL and deletion exercised at 375 and 1440. |
| GitHub complete baseline | [39043589162](https://github.com/sowmum93dotcom/restaurant-ai-learning/actions/runs/39043589162): completed success. |
| GitHub complete browser workflow | [39043589235](https://github.com/sowmum93dotcom/restaurant-ai-learning/actions/runs/39043589235): completed success. Both `browser` and `selling-webkit` jobs passed, including all existing regression steps. |
| GitHub real video workflow | [39043589190](https://github.com/sowmum93dotcom/restaurant-ai-learning/actions/runs/39043589190): completed success. HTTP and native real MOV encoding, three private MP4 outputs, SQL association/ownership and actual Chrome playback, plus native frame extraction/cache checks. |
| Image regression | Actual private PNG upload/decode/processed persistence, replacement/deletion, hashes, ownership and refresh retained in baseline/browser gates. |
| Existing UX | Seven workspaces, ten languages/Arabic RTL, CRUD, draft recovery, variants/stock/orders, responsive layouts, shared footer, identity and stale-write guards remain covered by the complete gates. |
| Actual model inference | NONE. Boundary fixture tests are not live inference. No weights downloaded or runtime activated. |
| Physical Safari | Not tested. Automated WebKit is not a physical iPad/iPhone test. |

Local native media measurements varied with concurrent test load. Representative
successful real-processing runs measured 4-frame extraction at 251 ms / 63,023
bytes for a 3-second source, and 475 ms / 66,586 bytes for a 60-second source.
The same run encoded them in 491 / 5,472 ms. The five-test focused run sampled a
2-second MP4 in 158 ms / 30,558 bytes. All recorded zero model invocations. These
are local wall times, not Preview latency, GPU inference or compute cost/analysis.
Reproducible catalogue measurements and limits are in
[pr708-real-execution.md](pr708-real-execution.md) and
[pr708-product-record-performance.json](pr708-product-record-performance.json).

The local browser environment required temporary Ubuntu WebKit/GStreamer library
extraction. An early WebKit run lacked media plugins and closed at the video
step; no pass was claimed for that run. After plugin installation the new frame
journey passed at 375px and the run progressed through larger widths. Its final
temporary log expired during the secure sign-in wait, so full local WebKit
completion is not asserted. The complete GitHub WebKit job above is independently
confirmed successful. Local standalone Chrome playback launches were blocked by
container socket restrictions, or Chromium lacked H.264; actual playback is
confirmed by the successful GitHub media workflow, not those local failures.
No application security checks were disabled to obtain acceptance.

## Preview evidence and remaining acceptance

Code Preview: https://restaurant-ai-learning-37ag0aldj-sowmum93dotcom.vercel.app/selling-dashboard.html

Vercel deployment `dpl_EPK4rfB2AF7M9gsnGSV8z5PXB46p` is READY, target null (Preview),
and metadata matches the exact tested implementation SHA. Final documentation
commit deployment/CI metadata is recorded in the PR/owner report separately.

Configured database isolation: Neon Preview branch `br-flat-snow-zatzl87u` /
`ep-fragrant-cake-za2a226e` differs from main `br-rapid-feather-zaz3jzoa` /
`ep-lucky-sea-zak6kfvx`. Vercel branch-specific POSTGRES_HOST/server Preview guard
match the former, Production POSTGRES_HOST matches the latter. Sensitive
effective connection URLs are not disclosed by the connector. No live SQL test
writes/migrations were made before effective runtime attestation.

Normal browser Vercel authentication permitted access to the protected frame-code
Preview `restaurant-ai-learning-nhb9d5rd7-sowmum93dotcom.vercel.app` (66b53aa).
The SQL-free diagnostic returned `authentication-required` as expected. The
Selling page rendered all seven navigation entries, ten-language selector and
official footer, then a stable sign-in screen. Genuine Clerk modal offered Google
or email authentication; there was no vendor session. The secure credential
prompt was cancelled. No further credential entry was attempted. No Vercel
protection, Clerk authentication or owner authorisation was bypassed.

Consequently **authenticated Preview acceptance is incomplete**: effective host
fingerprint, authorised vendor/business, deployed create/edit/upload/playback,
analysis/review/save/refresh, cross-business rejection and authenticated language/
responsive journeys still require that genuine vendor session. The normal server
isolation guard remains before repository access; the new diagnostic permits a
SQL-free explicit attestation once signed in. Never treat build readiness or
local identity fixtures as successful deployed vendor acceptance.

No real visual semantic capability is operational. Next actions require approved
DEMEOS model hardware/runtime/security/licence review and measured inference,
plus secure vendor sign-in for Preview acceptance. The reviewed infrastructure
proposal, budget cap and exact outstanding dependencies are in the implementation
report. No approval to spend or provision was inferred.
