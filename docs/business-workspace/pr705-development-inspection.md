# Selling Vendor Development inspection

PR #705 adds `/selling-vendor/inspect` and `/selling-vendor/inspect/manage` for owner inspection of the existing Selling application. The PR #704 dashboard and editor remain the rendered interface.

The server permits this route only on Vercel Preview for `business-approval-application-access-705`. Production, missing environment metadata, and other branches return 404 before authentication or fixture generation. The existing Clerk sign-in boundary is reused; fixture data is returned only after a verified session. No administrator role is needed for this isolated inspection.

A labelled sample shop, one test jacket, matching front/back illustrations and a three-second demonstration clip exercise the existing interface. The clip has H.264 MP4 and WebM sources; no unrelated marketing or wildlife media is used. There are no sample orders or sales. Existing product validation and exact-variant stock rules process temporary sandbox edits. No database, repository, approval writer, Blob storage or payment service is called by the inspection handler. Real API routes and approval checks remain intact.

DEMEOS inspection caches use a session storage prefix for the verified Clerk user. Actual owner caches and Clerk authentication storage are preserved. Local file previews remain in the browser and their bytes are removed from inspection API requests. Large files that exceed browser session storage capacity are page-local. Catalogue and stock edits can survive inspection navigation within the browser session. These are inspection results, not durable database or cloud upload acceptance.

Validation performed locally:

- 1,481 Node tests passed; inspection security tests cover Production rejection, verified identity, same-origin requests, isolated storage and denial of real approval/customer operations.
- Inspection browser journeys passed at 390, 820 and 1440 pixels: nine languages, business identity, Add Product, edit/save/reload, automatic category fields, exact variants, multiple local images/video, sample video playback, main image selection saved from the gallery, catalogue search, accordion section persistence, stock changes/history after refresh and genuinely empty private orders. No live business API requests occurred.
- Existing Selling inventory SQL/API/browser gate passed all three widths, including CSV, gallery and ownership protections.
- Existing approval/application journey regression passed all models and widths, including scoped decisions and revocation. This is a regression check, not additional Marketing or Admin development.

Selling presentation corrections are scoped to the resolved Selling model: readable section contrast, compact language and catalogue controls, responsive cards and gallery buttons, one Add Product entry, and a progressively disclosed My Business form. The gallery exposes the existing catalogue confirmation/save operation so main-image and ordering changes can be saved without navigating away. Controlled inspection hides real-business creation, approval and submission actions; backend denials remain authoritative.

GitHub runs the complete existing Chrome browser gate and a separate WebKit inspection flow. WebKit verifies its engine and codecs on Linux; it is not a claim that a real iPhone or iPad Safari session has been tested. Local WebKit dependency installation was blocked by workspace system-package permissions, so that check runs in CI.

The owner confirmed all Selling sections and video playback in Safari on the previous deployment, but reported an intermittent access switch. The correction still requires exact-head CI and authenticated deployed stability acceptance before merge. No Production release or real vendor launch is claimed from a READY Preview alone.

## Inspection stability correction

The shared owner workspace refreshed permissions on focus, visibility change and a 30-second timer. Its generic handler classified a delayed 401 as a business denial and replaced the inspection model with a forbidden state while the inspection banner remained visible. A deterministic reproduction confirmed that transition. Available deployment logs did not establish the underlying reason for that particular HTTP failure; this is not evidence of a Google sign-in defect.

Inspection now owns its revalidation and fixed sample identity. Delayed real-business, loading or permission responses cannot replace an active ready inspection. A session expiry pauses the interface at the existing sign-in boundary; an account switch requires authenticated revalidation or deliberate reopening. Requests use the current Clerk session token and the server binds the sandbox to the verified identity. Stale responses after a session change or deliberate exit cannot commit sandbox state. Exit inspection opens the normal Selling route in a new document, restoring ordinary ownership and approval protections. The inspection sign-in shell does not load real owner business records.

Regression browser checks cover every Selling section, refresh, delayed session tokens, late foreign records, transient missing auth state, focus/timer 401 and 403 responses, authentication recovery, account switching and deliberate exit. Normal unauthorised real-business access remains denied. These checks run at mobile, tablet and desktop widths in Chrome and WebKit CI. No real account permissions, approvals, database records or payment settings are changed.


## Authentication freeze and compact navigation follow-up

The owner's next Safari screenshot showed `Loading authentication…`, with no dashboard. A controlled browser reproduction found that the inspection sign-in shell used `location.replace` with the same path and hash after receiving a session token. The same-URL replacement did not load a new document, leaving the old unauthenticated shell in its loading state. The shell now explicitly reloads when its URL is unchanged. One automatic handoff is allowed per 30 seconds; if the server still rejects the session, a private recovery screen offers Retry instead of entering a reload loop. An explicit retry clears the handoff marker and reloads the current section. No token or permission is stored in that marker.

Selling-only authentication preparation, session restoration and token waits have a 15-second deadline. Missing tokens cannot trigger a handoff. Late completion cannot reveal the workspace after the deadline, and repeated identical session callbacks do not reset the deadline. Inspection token/network/body waits are bounded too: timeout retains the Selling model, pauses operations and leaves Retry and Exit available. Authoritative authentication, identity and business checks are preserved.

The approved navy-and-gold presentation now uses compact, evenly sized navigation cells, four columns on tablet and two on phone, with a 44-pixel minimum target. The inspection notice uses a smaller text area with adjacent Exit/Retry controls. Long translated labels wrap within their cells.

The browser gate reproduces stalled config, SDK, Clerk loading, session restoration, token retrieval, missing tokens and a rejected document handoff, and verifies recovery without revealing sample or private business data. It also proves that a successful authenticated handoff reloads into the isolated Selling application with the original section hash. Existing gallery/video, variants, catalogue, stock/history, orders, nine-language and stale-response journeys remain required. Physical iPhone/iPad Safari acceptance and authenticated deployed acceptance remain release gates; CI WebKit is engine evidence, not physical-device evidence.


## Transient refresh must not freeze the workspace

The next owner screenshot showed the refresh-failure notice. `pause('unavailable')` previously set the complete authenticated workspace `inert`, so its navigation and all content stopped responding until an explicit retry or full page refresh. A timeout alone did not correct that interaction failure.

Transient inspection failure now leaves navigation usable. Previously validated sample GET responses may be shown only for the same currently authenticated inspection account and exact sandbox paths. They are not real business authorization or other-business records. Save/mutation requests remain blocked until live server revalidation succeeds; missing cached views show their existing service-failure state. Account change or authentication expiry clears retained read responses and conceals/inactivates the private workspace.

Retryable server/network failures schedule at most three recovery checks with 2/4/8-second backoff. Hidden/offline pages do not issue those checks; return-to-page and online events can revalidate through the existing controller. Explicit access denials do not schedule automatic retries. Recovery neither reloads the document nor changes its selected section. Retry/Exit remain available and the existing 15-second request deadline prevents the queue from hanging.

Focused Node and rendered-browser regressions simulate the outage, navigate to Stock and History while it is active, retain the sample quantity and section, reject saves and foreign-business reads, then recover automatically without a document request. Account-change/expiry and existing catalogue, gallery/video, variants, stock/history, orders and nine-language journeys remain covered. Available deployed error logs did not identify the original refresh HTTP failure; the inert-workspace defect is directly reproduced and corrected, without asserting an unobserved provider cause.
