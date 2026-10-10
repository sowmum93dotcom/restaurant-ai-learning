# Separate business applications

## Verified starting point

PR702 merge 6fc60da34b9a859f2db3ec3b03f5003dc044cf44 matches current main and production deployment dpl_8T2kmak5V5H6pd9qZwamyUVGFDRi, READY with www.demeos.io and demeos.io aliases. Inspected vendor-inventory-verification.md and vendor-order-reservation-verification.md, owner authentication, profile/onboarding, readiness, marketing preparation/campaigns/results, exact products/options/media, inventory and private orders.

## Applications and reused functions

Marketing Business Application: /marketing-business (overview), /marketing-business/manage (My Business, Products and Services, Media, Marketing Preparation and Campaigns), /marketing-business/results (recorded Marketing Results).

Selling Vendor Application: /selling-vendor (overview), /selling-vendor/manage (My Business, Product Catalogue, Images and Videos, Options and Variants, Stock and History, Private Orders).

Existing authenticated business-workspace.html becomes the entry destination. One authorised application opens directly; two authorisations produce two separate application links. A direct application route fixes its own application context. Neither onboarding's requested Marketing/Selling/Both field nor remembered browser preference switches operational applications or grants access. Legacy marketing.html and business-results.html links resolve to appropriate authorised routes; private onboarding remains available when application access is pending.

Existing overview, editor, factual draft workflow, submission, campaigns/results, gallery and media processing, exact variants, stock adjustments/history and authoritative private Orders/reservations are reused. Routes reuse the same existing HTML components and scripts through the same Vercel project; their rendered headers, navigation, overview and available operations are application-specific. No duplicate business, catalogue, category, database, provider, authentication or payment system is created. No selling results are invented.

## Authority and privacy

Inspection found generic owner actions and readiness that enabled both preparation views for every saved business; stock/order access additionally used owner-editable model intent. That is insufficient to establish separately authorised application access.

The existing authoritative business profile now supports protected applicationAccess.marketing and applicationAccess.selling boolean flags. Only exact true is accepted, for the exact owned business. The existing readiness and owner authorisation gateway consume these flags. This is a server-maintained extension of existing records, not another permission registry. Owner profile validation excludes the flags; creation, model changes and profile updates cannot grant access. Owned profile saves compare the previous profile atomically, so concurrent changes cannot restore a revoked flag. No grant-writing endpoint or Admin expansion is introduced.

Marketing generation, recommendations, campaign decisions/outcomes/lifecycle and campaign approval require Marketing access. Seller-only business responses omit private marketing campaigns, decisions and customer marketing evidence; marketing-purpose media is filtered and cannot be updated/uploaded without Marketing authority. Shared business identity and product media remain owned and private. Selling products/inventory/orders require Selling access. Stock/product SQL writes and Orders queries recheck ownership and explicit Selling authority against authoritative records. Existing stock signatures, revisions, atomic history and reservations remain intact. Missing grants fail closed even when onboarding intent says Both. Application API reads return403 for unauthorised routes; static shells contain no private records. Every connected-page business/media read carries its fixed application context; dual-authorised Selling reads also exclude Marketing evidence. Public customer links are root-relative on nested routes. Stale browser preferences cannot block an authorised entry, and existing Stock/Orders bookmarks enter the Selling application. Sign-in retains the requested application URL, and private content waits for owned server context before displaying.

Neither flag enables publication, live selling, checkout, order creation, merchant payments, settlement, external AI or administrative privileges. Existing canSell remains false and no customer order-creation endpoint or expiry scheduler is wired.

## Verification and evidence

Focused SQL/API tests cover missing/malformed/foreign flags, Marketing-only/Selling-only/dual/no grants, owner and anonymous denial, private campaign evidence, protected owner saves, unchanged model intent, marketing-purpose media, revoked-grant revision checks and one unchanged business identity. Existing stock/order tests cover concurrency, exact variants, retry identity, atomic history and cancellation/expiry.

Actual authenticated isolated SQL/API/browser journeys cover separate entries, direct route rejection, forged browser permission rejection, full-route application switching and refresh, existing factual drafts/private submission, catalogue/gallery/variants/stock/private Orders and sign-out. Screenshots /tmp/demeos-owner-application-{marketing,selling}-{marketing-only,selling-only,dual}-{390,820,1440}.png and existing vendor catalogue/stock/order images are retained in the required GitHub browser artifact. Application text extends existing vendor copy in all nine languages; no additional translation system is introduced. Browser fixtures use isolated identities and SQL, never production businesses, approvals, orders or payments.

Final checks, independent review, preview, merge and exact production evidence will be recorded in the PR release report.

## Remaining production prerequisites

Existing production records without explicit application access show pending access and retain private onboarding. No production grants were issued or inferred. A trusted operational authority must provision/revoke scoped application flags in existing records and verify genuine signed-in owners before broader access is claimed. The current Admin application review records review readiness, not application approval/grant activation; this assignment does not expand it. Production authenticated owner sessions and grant provisioning are not proven by isolated fixtures or anonymous checks.

Live selling, publication and payments remain disabled. PR702's production transaction/schema acceptance, authoritative merchant/selling permission, durable expiry scheduling, verified payment lifecycle and fulfilment/settlement prerequisites remain outstanding and unchanged. Production verification is safe and read-only.
