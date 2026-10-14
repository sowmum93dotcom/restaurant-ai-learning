# Selling Production entry correction

Baseline: PR705 merge 4519349ad92e6d60c6bad0e872c246084905d623.

The approved inspection rendered the existing dashboard/editor templates with verified sample authority. Normal Selling routes still rewrote to the shared Business Applications/Marketing documents. An unapproved owner received an authoritative denial, then the generic renderer removed the Selling theme, offered a return to Business Applications, and legacy CSS concealed even owned onboarding. Inspection acceptance therefore did not prove real Production application access.

Selling routes now use selling-vendor.html and selling-vendor-manage.html, derived from the approved existing templates with identical component IDs, controllers and Selling CSS. No inspection script/bootstrap is included. /selling-vendor/onboarding reuses that management document for an ownership-protected, unscoped business-profile read. Catalogue, media, stock and orders remain guarded by the existing server Selling permission and ready-state client gates. CSS retains the Selling presentation independently of permission, and only dedicated onboarding exposes owned setup while permission is pending. Real grants still require businessProfile.applicationAccess.selling === true, maintained by the existing review service. No approval or owner assignment is fabricated.

Verified Selling-only owners opening legacy bookmarks go to dedicated Selling onboarding when denied; this selects an interface and does not grant authority. Selling navigation no longer links to Business Applications or another operational application. Marketing route destinations and files are unchanged.

Regression coverage: exact Vercel route mappings, no inspection bootstrap, all seven sections, denied themed state without catalogue permission, legacy bookmark ownership matching, actual SQL/API dashboard/editor, denied grants, owned onboarding with protected panels hidden, session restoration and temporary focus failure without navigation, reload, business switching, media gallery, variants, inventory/history/CSV, private orders, sign-out and nine languages at 390/820/1440. Local SQL tests use isolated PGlite and a test identity-provider adapter; they do not constitute authenticated Vercel acceptance.

Release remains conditional on an authenticated real Preview session and successful deployed authorized/denied checks. No Production database, credentials, records, approvals or permissions were changed by this correction.

The real-entry regression also reproduced a Private Orders restoration race: its hidden-workspace observer cleared the selected order context but did not reactivate it when authentication revealed the same verified workspace. The observer now reactivates on reveal, through its existing ready-state and business-ID checks. A focused regression verifies restored loading without a new permission-model event; stale-account/denial tests remain intact.

## Selling-only build continuation

The Preview inspection sign-in shell and authenticated dashboard/editor now read the dedicated Selling entry documents, not business-workspace.html or marketing.html. Vercel bundles only those dedicated templates for this handler. Links are rewritten into the same inspection route, and the initial permission presentation marker is removed from the controlled shell so authentication waits cannot expose the workspace early. Approved structure, navigation, CSS and existing controllers remain unchanged. A regression refuses any read of an obsolete shared template and verifies the dedicated editor still contains upload and stock controls.

Validation: 1,491 Node tests pass. Controlled inspection browser scenarios pass at 390/820/1440, including eight authentication cases, local multiple-image/video uploads, catalogue editing, exact variants, stock/history, orders-empty state, all nine languages, outage recovery and deliberate exit. The existing isolated SQL/API/browser inventory journey passes all three widths too. No real business is needed for these tests, and no Production database, permission or payment writer is called by inspection.

Browser-local uploads are not durable cloud-upload verification. The private Preview Blob resource and secure media settings still need explicit resource authorisation after automatic approval review rejected creation as persistent and potentially billable. Do not infer that this prerequisite has been fulfilled from local upload success or a READY deployment.

## Authenticated Preview continuation (14 October)

Private Blob store demeos-selling-preview-media (store_CFrfc2lIe1tGwbgE) was created and connected to restaurant-ai-learning for Preview only with explicit owner approval. DEMEOS_MEDIA_STORAGE_PROVIDER and a sensitive upload-session signing secret are restricted to business-approval-application-access-705 Preview. No Production media variable or database record was changed. Storage provisioning does not make inspection's browser-local uploads durable or prove the normal media processing pipeline.

A real signed-in cloud-browser session reproduced the refresh failure on Images and Videos. Credential-free diagnostics identified session-token retrieval as the failing stage, before the inspection request reached the backend. Catalogue editing succeeded; safe reload retained the same section and edited sample. Subsequent uploads failed while inspection was paused. No automatic legacy-page navigation occurred.

Inspection now permits the existing same-origin server cookie verifier to resolve authority if Clerk's SDK getToken promise rejects. The handler still verifies Clerk authentication, origin and exact account identity; it remains Preview/branch-only and cannot access real records. Missing tokens returned normally and stalled token promises retain their existing fail-closed/deadline behavior. Focused tests cover successful cookie verification, 401 expiry and changed-account rejection. Full Node and controlled browser checks are required, followed by authenticated deployed acceptance. Physical Safari and durable cloud-upload acceptance remain open release checks.

The exact renewal blocker was then confirmed in Clerk's official fapiClient source: buildUrl returns a URL object and passes it to fetch. Inspection's interceptor read input.url for every non-string argument. A URL has no .url, so the renewal POST was classified as same-origin /undefined and rejected by the sandbox write guard. Cached tokens initially hid the fault. URL/Request/string normalization now preserves the intended destination before applying the same existing origin and write guards. The regression simulates a cached token followed by the real URL-object renewal shape and checks that unrelated external writes remain blocked. Cookie fallback alone did not fix ongoing renewal: the live server correctly rejected the cookie after its JWT expired. URL normalization is the actual correction.

## Private controlled upload continuation

The existing inspection uploader can now use the approved private Preview Blob store for original files. Activation requires the exact Preview branch, store, signing secret and verified controlled test owner allowlist. This grants no business approval and reads no real business records. Other inspection users retain browser-local uploads. The existing media upload-session and storage adapters issue exact immutable object paths, MIME/size limits and expiring upload URLs. The client delegates only that exact URL with its declared file and current account; arbitrary external writes remain blocked.

Completion verifies stored MIME and byte count, then probes actual original contents with Sharp or a restricted local ffprobe process. MP4/MOV duration must be at most 60 seconds; image/video dimensions are bounded. An HMAC receipt binds the verified metadata to the owner and sample product. Client-supplied object paths and derivatives are discarded. Private read links expire and are renewed from the derived path after refresh. Catalogue, stock and gallery references retain the existing isolated browser storage. Existing local test uploads are preserved.

This is readiness of private inspection originals, not transcoding, normal processing-queue completion, publication or Production approval. Normal services and authorisation remain unchanged. Production integration, normal media processing and physical Safari release acceptance remain separate checks. No Production deployment is authorised by passing the controlled tests alone.

## Authenticated private Preview upload verification — 14 October 2026

The live controlled image upload reached Ready, but the repository sample MP4 returned HTTP 409. A diagnostic Preview at da9da40bf0b299d232568eee370ddfd028eed92f recorded `DEMEOS private inspection video probe failed: MODULE_NOT_FOUND`. Vercel's file trace includes the ffprobe wrapper but cannot resolve its dynamically selected platform package metadata. The existing includeFiles supplied only the executable. An isolated function-bundle regression reproduces the missing `@ffprobe-installer/linux-x64/package.json` error without access to the repository node_modules.

Correction c2e6c358a67027176e989a9e015fa65811f8c1dc explicitly includes the platform package metadata alongside the executable. The isolated regression passes and probes the actual sample MP4 duration as three seconds. All 1,504 Node tests pass. No dashboard, section, route, business authority, database, payment or Production configuration was changed.

Authenticated deployed checks on READY Preview dpl_BWfSK6EX1ESuvaZ1nMZXs8TQnW1u:

- A controlled 640 by 480 PNG and the repository sample MP4 both uploaded to private Preview storage and reached Ready.
- Both were added to the sample product gallery; Save products returned Products saved.
- A document refresh retained both Ready assets and gallery positions four and five on the Images and Videos section. The image decoded at 640 by 480. The private video loaded with readyState four, duration three seconds and no media error, then played to completion with currentTime three and ended true.
- An unsigned request to the uploaded image object returned HTTP 403.
- All seven existing navigation entries remain present. Overview, My Business, Product Catalogue, Images and Videos, Options and Variants, Stock and History, and Private Orders were opened. Orders correctly displays no orders and live ordering inactive. No automatic switch to Business Applications was observed.

Preview entry: https://restaurant-ai-learning-git-business-appro-e191e4-sowmum93dotcom.vercel.app/selling-vendor/inspect/manage#media

These results verify controlled private originals and browser-session gallery persistence, not production processing, publication or real-business approval. Expired-link renewal remains covered by the existing server regression; a wall-clock expiry test was not performed in this session.

Physical iPad/iPhone Safari upload, playback and refresh acceptance is still OPEN. This environment's WebKit gate could not start because required OS libraries were absent; dependency installation was unavailable. No Safari success is claimed. PR705 was already merged on 13 October before the owner's saved 9484939 continuation; no subsequent merge or Production deployment was performed in this session. Keep the continuation unreleased until physical Safari acceptance is recorded.

## Owner Safari acceptance and Selling setup separation — 14 October 2026

At 02:19 London time the owner confirmed that the iPad Safari image/video upload, playback and refresh checks requested for the previous correction passed. This is owner-reported physical-device acceptance, separate from the authenticated cloud-browser evidence above.

The owner approved keeping Marketing and Selling as distinct applications. Selling My Business now contains Business, Selling preparation and Review, with no Marketing/Selling/Both chooser or Marketing context inputs. The existing application entry determines the displayed workflow; the original preparation model is preserved internally for an existing shared business, and new Selling setup defaults to Selling. This does not grant either application permission. Existing Marketing context is preserved when saving a shared business from Selling, rather than erased by the removed controls. Review omits Marketing context in Selling even for an existing both-applications business. Obsolete browser disclosure state pointing to the removed Marketing group falls back to Your business.

Marketing preparation actions are no longer appended to Selling product or media cards. Catalogue, galleries, multiple uploads, variants, stock/history, private orders and all seven navigation sections retain their existing implementation and navy-and-gold presentation. The Marketing application and its editable context remain unchanged. The 171-category expansion is outside this correction.

Validation: 1,508 Node tests pass. Chromium inspection journeys pass at 390, 820 and 1440 pixels, including all nine languages, removed-field absence, restored disclosure state, media/gallery operations, stock/history, refresh and authentication recovery. SQL-backed application journeys pass Marketing, Selling and Both at each width, including Selling profile save/reload, preservation of Marketing context and model, approval and revocation checks. Following a profile save, the admin test refreshes its review snapshot before the next decision, preserving the existing optimistic version guard. No server permission or approval changes were needed.

This continuation is Preview-only. No new PR, merge or Production deployment is included. Confirm the deployed Selling My Business correction before the next category implementation step.
