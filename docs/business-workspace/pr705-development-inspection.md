# Selling Vendor Development inspection

PR #705 adds `/selling-vendor/inspect` and `/selling-vendor/inspect/manage` for owner inspection of the existing Selling application. The PR #704 dashboard and editor remain the rendered interface.

The server permits this route only on Vercel Preview for `business-approval-application-access-705`. Production, missing environment metadata, and other branches return 404 before authentication or fixture generation. The existing Clerk sign-in boundary is reused; fixture data is returned only after a verified session. No administrator role is needed for this isolated inspection.

A labelled sample shop, sample clothing, two images and a sample video exercise the existing interface. There are no sample orders or sales. Existing product validation and exact-variant stock rules process temporary sandbox edits. No database, repository, approval writer, Blob storage or payment service is called by the inspection handler. Real API routes and approval checks remain intact.

DEMEOS inspection caches use a session storage prefix for the verified Clerk user. Actual owner caches and Clerk authentication storage are preserved. Local file previews remain in the browser and their bytes are removed from inspection API requests. Large files that exceed browser session storage capacity are page-local. Catalogue and stock edits can survive inspection navigation within the browser session. These are inspection results, not durable database or cloud upload acceptance.

Validation performed locally:

- 1,479 Node tests passed; four inspection security tests cover Production rejection, verified identity, same-origin requests, isolated storage and denial of real approval/customer operations.
- Inspection browser journeys passed at 390, 820 and 1440 pixels: nine languages, business identity, Add Product, edit/save/reload, automatic category fields, exact variants, multiple local images/video, sample video playback, main image selection, stock changes/history and genuinely empty private orders. No live business API requests occurred.
- Existing Selling inventory SQL/API/browser gate passed all three widths, including CSV, gallery and ownership protections.
- Existing approval/application journey regression passed all models and widths, including scoped decisions and revocation. This is a regression check, not additional Marketing or Admin development.

A previous complete Chrome launch was blocked by the workspace process sandbox. The installed headless browser subsequently ran these checks successfully. GitHub performs the existing complete browser gate with Chrome.

Deployed authenticated acceptance and the final exact-head GitHub browser gate remain required before merge. The cloud browser's fresh Google sign-in returned a proxy 502 connection-refused response; no deployed signed-in inspection success or Production release is claimed from a READY build alone.
