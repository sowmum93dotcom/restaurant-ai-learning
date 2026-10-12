# Selling Vendor Development inspection

PR #705 adds `/selling-vendor/inspect` and `/selling-vendor/inspect/manage` for owner inspection of the existing Selling application. The PR #704 dashboard and editor remain the rendered interface.

The server permits this route only on Vercel Preview for `business-approval-application-access-705`. Production, missing environment metadata, and other branches return 404 before authentication or fixture generation. The existing Clerk sign-in boundary is reused; fixture data is returned only after a verified session. No administrator role is needed for this isolated inspection.

A labelled sample shop, one test jacket, matching front/back illustrations and a three-second demonstration clip exercise the existing interface. The clip has H.264 MP4 and WebM sources; no unrelated marketing or wildlife media is used. There are no sample orders or sales. Existing product validation and exact-variant stock rules process temporary sandbox edits. No database, repository, approval writer, Blob storage or payment service is called by the inspection handler. Real API routes and approval checks remain intact.

DEMEOS inspection caches use a session storage prefix for the verified Clerk user. Actual owner caches and Clerk authentication storage are preserved. Local file previews remain in the browser and their bytes are removed from inspection API requests. Large files that exceed browser session storage capacity are page-local. Catalogue and stock edits can survive inspection navigation within the browser session. These are inspection results, not durable database or cloud upload acceptance.

Validation performed locally:

- 1,479 Node tests passed; four inspection security tests cover Production rejection, verified identity, same-origin requests, isolated storage and denial of real approval/customer operations.
- Inspection browser journeys passed at 390, 820 and 1440 pixels: nine languages, business identity, Add Product, edit/save/reload, automatic category fields, exact variants, multiple local images/video, sample video playback, main image selection saved from the gallery, catalogue search, accordion section persistence, stock changes/history after refresh and genuinely empty private orders. No live business API requests occurred.
- Existing Selling inventory SQL/API/browser gate passed all three widths, including CSV, gallery and ownership protections.
- Existing approval/application journey regression passed all models and widths, including scoped decisions and revocation. This is a regression check, not additional Marketing or Admin development.

Selling presentation corrections are scoped to the resolved Selling model: readable section contrast, compact language and catalogue controls, responsive cards and gallery buttons, one Add Product entry, and a progressively disclosed My Business form. The gallery exposes the existing catalogue confirmation/save operation so main-image and ordering changes can be saved without navigating away. Controlled inspection hides real-business creation, approval and submission actions; backend denials remain authoritative.

GitHub runs the complete existing Chrome browser gate and a separate WebKit inspection flow. WebKit verifies its engine and codecs on Linux; it is not a claim that a real iPhone or iPad Safari session has been tested. Local WebKit dependency installation was blocked by workspace system-package permissions, so that check runs in CI.

Deployed authenticated acceptance, Safari device video playback, and final exact-head CI results remain required before merge. No Production release or real vendor launch is claimed from a READY Preview alone.
