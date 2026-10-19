# Authenticated Preview verification — 19 October 2026

Verified the existing Selling dashboard on deployment `dpl_Cf3GNBj162i6LGuwJ3exYxeEM9na`, commit `7d1e85f6925e78ba67ca5a2d01ab0e05a0b9b205`. Normal Clerk Google sign-in and the owner's secure two-step approval established a genuine authorised session. No authentication bypass, credential extraction or Production deployment was used.

## Isolation before writes

The SQL-free `selling-isolation` endpoint returned `verified: true`, `databaseAccessed: false`, the exact deployment commit, and fingerprint `bb25784eb2c6b9697cea173e8624403cd00c7525b19c1e9fc4e89e885dd4e72a`. Independent Neon endpoint inventory and SHA-256 comparison match Preview endpoint `ep-fragrant-cake-za2a226e`, branch `br-flat-snow-zatzl87u`. Production endpoint `ep-lucky-sea-zak6kfvx` has a different fingerprint. All verification writes below were through the normal UI to authorised test business `test-business-selling-708`.

## Actual deployed results

- My Business: saved explicitly labelled verification-only country/address/description, refreshed and confirmed country `GB` and street address persisted. No real business address was inferred. The existing Mango product was not edited.
- Product Catalogue: created `Preview acceptance product 19 Oct`, SKU `PREVIEW-20261019`, with a clear not-for-sale description. Edited its description and confirmed the saved edit after refresh. It remains a draft, not published.
- Options & Variants: saved `Preview option`, SKU `PREVIEW-20261019-A`, using product price; confirmed persistence after refresh.
- Stock & History: saved quantity 4, threshold 2 and an explicit Preview-only adjustment reason for that variant. Quantity and threshold persisted, but the deployed paginated response dropped the audit history. This exposed the correction below.
- Images & Videos: uploaded the repository's DEMEOS logo PNG as a declared image fixture and a two-second FFmpeg-generated colour test-pattern MP4 to the new verification product. Both completed and linked privately. Actual browser video playback reached `currentTime: 2`, `duration: 2`, `ended: true`, `readyState: 4`, no media error. Native extraction completed; all four sampled images and the video poster survived refresh. These are media-processing checks, not visual AI inference.
- The older Mango video remains in its pre-existing processing state and was not resumed, removed or changed. New verification records remain clearly labelled in isolated Preview; no existing records were deleted.

## Stock audit correction

The shared paginated catalogue response used by Stock & History returned `history: []` even though the adjustment was stored. It now retains the repository's bounded latest-30 audit batches, filters each batch's changes to products on the current page and omits empty batches. The original stored audit records are unchanged. This also avoids returning off-page changes in a mixed-product batch.

A real-SQL regression failed on the missing audit batch before the fix and passed afterward. It checks quantities, recorded identity/reason, mixed-product batch filtering, unchanged-product exclusion and preservation of the source audit record. Browser checks now require the reason to remain visible after reload in normal and isolated Preview workflows.

Local verification: all 1,553 Node tests passed, zero failures/skips. Complete Selling gates passed in Chromium and Playwright 1.55 WebKit at 375, 390, 430, 761, 820, 1024, 1280 and 1440 px, including the new rendered audit assertions, ten locales, SQL workflows, fixture proposal review and actual FFmpeg extraction. Remote CI and deployed confirmation for the audit correction must be recorded separately; the authenticated results above concern the named prior deployment.

## Remaining acceptance

Genuine GPU/runtime installation, deadline/quality measurements, live AI proposal review, physical Safari testing, and remaining deployed language/access/private-order checks are not established by these results. The runtime remains disabled and the original Runpod pod remains stopped. No fabricated order, AI response or approval was created.
