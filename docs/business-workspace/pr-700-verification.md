# PR 700: model-specific owner workspaces

Baseline: main 5a872b32ce560cfe649571e86b5ea132d9d67c93, production dpl_ErBzzcHJLzyKkhfzdhuiu7jdRvNN READY.

## Existing contracts and root cause

The owner GET requires trusted authentication and exact database ownership. Its existing workspaceReadiness contract grants both marketing and selling preparation for saved owned profiles, while canSell is false, approval is false, and drafts remain private. Saved preparationModel is intent only; it is never authority. This change preserves those contracts and does not introduce production model entitlement rules.

The previous renderer returned the same message for missing business selection, missing/foreign/malformed readiness, failed reads and denied preparation. With a genuine matching successful current server record both preparation flags are true, so that message is a fallback rather than evidence that both models were denied. A screenshot alone cannot identify which request failed. This change distinguishes setup, pending review with unresolved permissions, explicit denial, forbidden business access and failed/malformed readiness reads. No business, identity or permissions are inferred from browser facts.

Product options/variants and availability states exist in the authoritative catalogue. Stock balances, vendor orders, verified selling reporting and settlement interfaces do not. The customer payment store is private customer payment status, not vendor order permission or inventory. Checkout still requires separate trusted merchant/product/publication/payment configuration and remains disabled.

## Presentation

Marketing: Overview, My Business, Products and Services, Marketing and Results. Existing private drafts/campaigns, approved external continuation configuration and recorded customer interest remain available. No stock, merchant, checkout or order controls.

Selling preparation: Overview, My Business, Product Catalogue and Options and Availability. The shared editor preserves exact product IDs, categories, combinations, prices, availability and media. Options view starts from saved products and focuses their existing choice controls. Marketing controls and marketing results stay out of Selling. Stock quantities, vendor orders and verified sales/settlement are listed as future dependencies, with no operational endpoints or invented values.

Only matching strict server canPrepare=true permits preparation presentation. Dual-authorised owners have a view switch scoped to the business in session storage. The saved server model intent is the default. Client intent and preferences cannot grant access, and changes/failures clear the previous model. Direct restricted panel links return to My Business. Existing ownership, authentication and payment boundaries remain authoritative.

## Validation and release

Local full Node suite and isolated permission resolution tests. Required GitHub SQL/API/browser gate at 390, 820 and 1440 covers marketing-only, selling-preparation, dual, pending, denied, missing readiness, malformed/foreign readiness, failed and forbidden reads, saved server intent, product/options navigation, drafts, media, private submission, Results and sign-out. New-owner fixtures cover missing business and existing nine-language onboarding. Required customer regressions remain unchanged.

Independent reviewer identified stale model presentation after a business switch failure, marketing buttons in Selling, and an unfocused options view. These are resolved with reset/failure states, hidden/guarded actions and the focused shared options editor.

Screenshots: demeos-owner-workspace-{marketing-only,selling-preparation,dual,pending,denied,missing-readiness,malformed,foreign,failed,forbidden}-{390,820,1440}.png, plus selling options and existing onboarding/product/draft/results images. Browser workflow uploads its customer-experience-review artifact.

Local browser launch is restricted by socket policy. GitHub browser results are the rendered release authority. Production verification is read-only: exact deployment/commit/aliases, matching changed frontend files and anonymous private API/auth boundaries. Genuine production owner usability is not claimed. No production accounts/businesses or approvals are created, no unapproved content is published, no payments/external AI are activated. Release hashes and results will be recorded in the PR. Stop after PR 700.
