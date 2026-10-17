> Historical evidence for 861cf938. The subsequent implementation and current status are in [pr708-real-execution.md](pr708-real-execution.md) and [pr708-real-execution-verification.md](pr708-real-execution-verification.md). Statements below about unavailable frame extraction describe the earlier commit.

# PR 708 visual foundation: verification record

Verified locally on 2026-10-17. Base code: 7fc08013d9fa6e3c6cf70bb697cf24f147303160.
No live model inference, Production writes, Production deployment, paid resources
or physical-device Safari acceptance are claimed.

| Boundary | Evidence |
| --- | --- |
| Full baseline | `npm test`: 1543 passed, 0 failed, 0 skipped; 30.85 seconds. |
| Final focused visual assertions | `node --test test/selling-visual-foundation.test.js`: 11 passed; includes actual source-hash duplicate findings. |
| Optional projection | Isolated SQL install/backfill/update/delete/rollback, ownership, original JSON/audit/revision preservation: passed in baseline and focused run. |
| Chromium Selling flow | `node browser-checks/selling-dashboard-gate.js`: passed at 375,390,430,761,820,1024,1280,1440 pixels. |
| WebKit Selling flow | Same gate with `DEMEOS_BROWSER_ENGINE=webkit`: passed at all eight widths. This is browser-engine automation, not physical Safari. |
| Upload bytes and display | Browser gate sends actual PNG bytes through private upload, decoding, optimized storage, ready/link SQL and rendered display; hashes and processed byte count asserted after persistence. Replacement/deletion, ownership and refresh coverage retained. |
| Video HTTP processor | `node tools/video-processor/verify.js`: passed; real MOV sources 3s/60s, H.264 MP4/AAC when present, three private outputs, SQL ready/link, foreign-owner rejection and browser playback. Encoding journeys measured 742/6116 ms in this run. |
| Native Preview FFmpeg driver | `node tools/video-processor/verify.js --native`: passed same real-media verification; 506/5112 ms. These are processing journeys, not visual-model latency. |
| UI and language | Existing seven routes, ten locales, Arabic RTL, official logo/shared footer, CRUD/draft recovery, selection, variants/stock/orders, stale-write/owner guards, non-switching session behavior tested by the Selling gate. Compact media actions retain >=44px targets and <=14px type. Screenshots inspected at 375px and 1440px. |
| Model boundary | Disabled default, input/output schema, unsupported capabilities, model provenance, timeout, transient retry ceiling, unchanged-media cache, budget/dedup, cross-business/stale revisions, proposal accept/edit/reject: fixture-only tests pass. No weights or genuine model calls. |
| Static correctness | `git diff --check` and changed-module syntax checks pass. |

The machine initially lacked WebKit system libraries. Ubuntu snapshot packages
were extracted into temporary directories and linked into the temporary browser
bundle. The libGLES dynamic-load check uses the system ldconfig cache, so that
preflight was skipped after an actual shared-library load check; the WebKit
engine itself launched and ran the full gate. No application/authentication
checks were skipped. No repository dependency or system-library change was
required to ship the app. CI installs normal browser dependencies.

The gate deliberately cancels old requests during route changes and identity
reset tests. Its expected ERR_ABORTED / Load request cancelled messages are not
reported as successful network calls; each gate must still exit zero.

## Deployed acceptance limitations

The existing Preview at the base SHA was READY in Vercel. New-head deployment
and CI status must be checked after publishing the branch; record the exact SHA
and immutable Preview URL in the final owner report.

Branch-scoped Preview POSTGRES_URL and server isolation settings are present.
Vercel returned the nonsecret isolation settings, but did not return the
protected database URL. Configuration presence alone does not prove actual
connection-host separation from Production. Therefore no authenticated deployed
API/database test writes or migrations were performed. Owner Clerk sign-in and
its secure two-step journey were not bypassed. Physical iPad/iPhone Safari
acceptance remains outstanding.

The local SQL fixtures do not use Neon credentials or a remote database. They
exercise the shipped API/data/rendering path with a controlled identity adapter
and isolated SQL, not a separate testing dashboard.

## Scope of release readiness

This branch can be reviewed as an implementation foundation. It is not accepted
as a complete visual AI system or as a Production release. The default deployed
model status remains unavailable; the optional product projection is not active;
video cover extraction and full semantic video analysis are not implemented.
Independent content-safety/media-consistency/publication authority remains held.
