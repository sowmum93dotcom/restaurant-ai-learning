# Controlled Customer Experience media

The supplied twelve images and full garden/wildlife video are fictional test fixtures on the existing Customer Experience route:

https://www.demeos.io/customer.html?demeos-test=1#discover

The API requires both the exact `demeos-test=1` query and `x-demeos-test-mode: controlled-preview` header. Ordinary requests continue to use approved production work. No fixture is stored as a vendor or business record.

Six labelled test businesses cover fashion, groceries, sports, outdoor activities, children/family and garden/wildlife marketing. Each product image matches exactly one product in its own test business. Sports/outdoor services use booking continuation; merchandise uses website continuation. Both point back to the controlled DEMEOS route as a safe fictional destination. No actual sale, booking or payment occurs. The garden video has no product relationship or continuation.

Images are optimized WebP derivatives with their original proportions and complete composition. The entire 64-second video has H.264/AAC MP4 and VP9/Opus WebM sources, with inline controls and fast-start MP4 metadata. Grocery artwork and garden video remain view-only marketing. The source-to-asset manifest records names, hashes and image dimensions.

Set `DEMEOS_CONTROLLED_TEST_CONTENT=disabled` in deployment configuration to turn off both controlled fixture feeds without modifying real business data. The controlled client fails closed when the API does not confirm test mode. Remove the testing query to browse normal approved production content.

Verification: `npm test`; `node browser-checks/customer-language-gate.js`; `node browser-checks/customer-controlled-media-gate.js`. The media browser gate covers 390px, 820px and 1440px widths, full asset decoding, aspect ratios, all eleven product/service continuations, exact identities and destinations, and real video playback. Set `DEMEOS_BROWSER_BASE_URL=https://www.demeos.io` to run it against the production page with no fixture or asset mocks.

The ordinary Customer Experience offers a clearly labelled controlled-test link. That link carries the activation query; the controlled view provides an explicit return to normal production. Work API responses are private and not cached, and vary by the activation headers. The exact two-part server gate and disable switch remain unchanged.

Controlled fixture text, media labels, options and product/service continuation use the existing nine-language Customer Interface controller and its copy-catalogue pattern. Changes apply to asynchronously loaded cards and to an already-open Product Experience. Business and product identities, availability and continuation routes remain semantic metadata; translated display text does not determine their destinations. Ordinary business-provided text is excluded. The browser gate also covers all nine languages, language changes while a product is open, saved-language reloads, normal/test transitions and both business and media keyboard navigation.

The expanded gate caught an Arabic tablet regression: media position and scrolling measured only the left edge. Galleries now measure the reading-direction edge, and card arrow keys delegate to the same validated media controls. The gate exercises both directions in every language at each viewport.
