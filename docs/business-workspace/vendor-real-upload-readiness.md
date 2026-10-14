# Real vendor upload readiness

Production baseline: 82e3e4de2e63ddbb6708dba0a52ea70b68517e98. This continuation addresses the owner's 14 October report that signed-in Selling sections were blank.

## Confirmed boundaries

Read-only Production inspection found the owner's Selling business is still a draft, not submitted, and has no application grant. The normal server permission boundary therefore denies operational access. The Preview inspection is a separate sample authority and cannot approve this business. No business grants, database credentials or authentication roles were changed.

The previous release had no Production media storage, upload signing secret or processing provider. Preview original-file uploads did not verify normal business transcoding or the processing queue.

## Implemented continuation

The navy-and-gold dashboard and seven sections are retained. Pending sections display a visible status card, an explanation of which tools require Selling approval, and My Business as the next action. The note supports all nine languages. Setup remains accessible; no hidden control is exposed by changing presentation.

Native private media processing now downloads only delegated Blob sources with byte and time limits, inspects the actual file, optimises images to WebP and converts video to H.264/AAC MP4 with fast-start. FFmpeg 7.0.2 is supplied by pinned ffmpeg-static 5.3.0; the function bundle explicitly includes its executable and ffprobe metadata. Input protocol and container restrictions, resolution limits, processing deadlines and temporary-file cleanup remain enforced. Only exact business/asset/role output paths are accepted. Private outputs are checked in storage before ready state is saved.

Upload completion schedules processing through Vercel waitUntil. The owner's media reload can resume its own queued work, with atomic SQL claims, one active job per business, bounded retries and scoped stale lease recovery. Gallery responses renew private delivery capabilities instead of reusing expired links. The browser polls processing state and renews ready delivery links. Native uploads fail clearly before registering a dangling asset if upload signing or storage is unavailable.

## Verification and remaining release gate

1,517 Node tests pass, including actual image/MP4 conversion, H.264 pixel format verification, output persistence, renewed private reads, foreign-business rejection and SQL queue isolation. Normal SQL/API approval journeys pass Marketing, Selling and Both at 390/820/1440, with all nine languages, draft access cards, independent review, approval and revocation. The existing inventory/gallery regression gate passes all widths.

The native upload browser gate uses the real API handlers, queue, persistence and file processor with isolated identity and Blob transports. This is not evidence of live Production uploads. Its installed Chromium lacks H.264 playback; the default gate remains strict. An explicit metadata-only mode verifies upload, processing, gallery save, reload and decoded images while reporting playback as pending. The synthetic native-video fixture allows a codec-capable deployed browser to verify the actual encoded output, without business data.

A separate empty private Production store, demeos-vendor-production-media (store_qh2GSnoj71vUBOkc), has been provisioned. It is not connected to any project yet. The existing private Preview store and its connection are unchanged. The branch-specific Preview native processing setting has been added.

Release remains blocked until the Production-only private store connection is confirmed, the Production signing/configuration is complete, and the normal authenticated approved-vendor path is verified with live private storage, image/video playback, gallery save and refresh. Business submission and an independent authorised reviewer are required for the owner's real draft; code deployment and owner selection never grant application access. Live selling, payments and external AI remain disabled. No additional PR is created.
