# DEMEOS private video processor

The processor runs natively in the existing Vercel Preview Function using bundled
FFmpeg/FFprobe. An optional dependency-free Docker HTTP service is also provided.
Sharp continues to process images in the existing application. This service only
inspects and transcodes video. It does not own identities, SQL, catalogues or
media records, and cannot publish anything.

## Native Preview configuration

The existing `sharp` image provider is retained. Only this PR branch's Preview
receives `DEMEOS_VIDEO_PROCESSING_PROVIDER=ffmpeg`. The native video driver is
explicitly disabled outside `VERCEL_ENV=preview`; no Production configuration
is changed. Binaries are pinned as `ffmpeg-static@5.3.0` and
`ffprobe-static@3.1.0`. Only the Linux/x64 FFprobe binary is resolved and traced;
`vercel.json` includes the two exact executable paths in `api/businesses.js`.
Their combined size is approximately 139 MiB before other Function dependencies.
The existing 60-second Function limit is retained.

No separate provider, new subscription, processor URL/token, database credential
or owner infrastructure authorization is needed for this native path. Existing
Vercel compute and private Blob usage charges apply. Activation is confined to
the named Preview branch. Actual authenticated Preview upload/playback remains
an acceptance requirement; a successful build is not that acceptance.

Source: https://github.com/vercel-labs/ffmpeg-on-vercel and
https://vercel.com/docs/functions/limitations .

## What is implemented

- Bearer authentication with a server-only token of at least 32 random characters.
- Exact HTTPS storage-host allowlist, expiring read capabilities, asset/business
  scoped output keys and no redirects. No permanent Blob or database credential.
- Download limit 250 MB; actual container/stream inspection, MP4/MOV only, maximum
  60 seconds, 4K pixels and 120 fps. Input MIME alone is never accepted as proof.
- Real H.264/yuv420p video, optional AAC stereo audio, 30 fps, fast-start MP4.
  Long side is capped at 1280 pixels without upscaling; aspect ratio is retained.
- One encode is uploaded to the existing private master/customer/marketing output
  keys. These are independent private objects, not customer publication or writes
  to either the Marketing application or Customer interface.
- One concurrent operation; overload returns 429, not a fabricated ready result.
  FFmpeg has a 22-second execution budget, FFprobe 4 seconds per call and storage
  requests 8 seconds. Files exceeding the resource budget fail safely; performance
  on the selected host must be measured before acceptance. Temporary files are
  removed on both success and failure. No persistent disk is needed.
- Existing SQL queue, retry/resume, output HEAD verification, owner authorization
  and product-gallery linking remain authoritative. A successful HTTP response
  alone cannot mark missing output objects ready. The native driver uses the same scoped capabilities locally; images continue
  through Sharp.

## Optional external hosting (not required by the native Preview path)

Only if native execution proves insufficient and the owner chooses a separate
service: **Render Docker Web Service**, one `1c-2g` instance (legacy name
Standard), 1 CPU / 2 GB RAM, HTTPS endpoint, `/health` health check. Dockerfile:
`tools/video-processor/Dockerfile`; Docker build context: repository root; branch:
`rebuild/selling-foundation-phase-1`. Disable auto-deploys initially and deploy
only the reviewed commit. No autoscaling, persistent disk or domain purchase.

Published compute price checked 2026-10-16: **USD $25/month** for that instance,
prorated by runtime, plus the owner's workspace plan and metered usage. Hobby
workspace is $0/month; Pro workspace adds $25/month. Hobby includes 5 GB outbound
bandwidth; Pro includes 25 GB; excess public outbound is $0.15/GB. Builds beyond
included minutes are $5/1,000 standard minutes. Existing Vercel Blob storage,
operations and transfer charges also apply: original plus three encoded objects,
with two source reads and three output writes per successful video. Higher
compute capacity, extra instances and workspace upgrades need separate approval.
This is a proposed paid configuration, not a claim it has been purchased.

Sources: https://render.com/pricing and
https://render.com/docs/compute-plans and
https://render.com/docs/outbound-bandwidth and
https://render.com/docs/docker . Check the final checkout estimate before activation.

Owner must authorize the $25/month processor and temporary processing of the
selected business's uploaded video on Render, and provide Render access with
permission to create/deploy that single service and connect this repository.
Do not paste credentials into chat. Configure secrets through provider controls:

| Location | Setting | Required value |
| --- | --- | --- |
| Render service | `PROCESSOR_TOKEN` | Cryptographically random server-only secret, at least 32 characters |
| Render service | `STORAGE_HOSTS` | Comma-separated exact hostnames from this Preview's actual signed Blob read/write URLs; no wildcards |
| Vercel Preview, exact PR branch only | `DEMEOS_MEDIA_PROCESSING_URL` | The deployed Render service HTTPS origin |
| Vercel Preview, exact PR branch only | `DEMEOS_MEDIA_PROCESSING_TOKEN` | The same server-only secret |
| Vercel Preview, exact PR branch only | `DEMEOS_MEDIA_PROCESSING_PROVIDER` | Keep existing `sharp` |

Render receives expiring per-file read/write capabilities only. Never give it
`BLOB_READ_WRITE_TOKEN`, Clerk secrets or a Postgres URL. Do not change Production
environment variables. After approved activation, redeploy Preview and test an
owner-authenticated MOV/MP4 upload, SQL ready state, product linking, playback,
refresh and removal, alongside an image regression. This external option has not been activated and must not be purchased without
explicit approval. It is not a prerequisite for the native Preview path.

## Reproducible verification

With Node 22, system FFmpeg/FFprobe and repository dependencies installed:

```
node --test test/video-processor.test.js
node tools/video-processor/verify.js
node tools/video-processor/verify.js --native
```

For real browser decoding too, install Google Chrome (`npx playwright install chrome`) and run:

```
node tools/video-processor/verify.js --browser
node tools/video-processor/verify.js --native --browser
```

The verification generates actual 3-second MOV with PCM audio and 60-second MOV
without audio, exercises both the authenticated HTTP processor and the bundled native driver, registers and
completes uploads through the shipped Selling handler and isolated PGlite SQL,
checks H.264/AAC, fast-start atoms, all three private objects, ready state,
product linking, rejected cross-owner access and customerVisible=false, then
plays the encoded output in Google Chrome. Only storage capabilities and identity are
isolated test adapters; the encoder, HTTP service, SQL/API and playback are real.
CI repeats this in the `Selling Video Processor` workflow. These checks do not
substitute for owner-authenticated testing against the deployed infrastructure.
