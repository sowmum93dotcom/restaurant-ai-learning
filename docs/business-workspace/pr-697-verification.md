# PR 697: business onboarding readiness and workspace connection

Baseline: PR 696 production READY for merge 9eab8e7527ce61433592ac1c74d90756a2b6959c.

## Existing implementation

Owner Clerk authentication and its single dialog, server-resolved identities, owner-only business listing and reads, atomic first-owner business creation, existing business profiles, the same product catalogue and structured category/variant contracts already existed. My Business previously required navigation through detailed profile and product panels, and new saves sent owners directly to marketing recommendations. There was no private business application submission state or business administrative approval workflow.

## Connected preparation journey

Overview guides an authenticated owner with no business to existing My Business. Four expandable groups reuse existing fields: business identity/activity and supported offering category; preparation model plus actual continuation and fulfilment; customer and marketing context; saved-information review. The general activity description remains one field and now sits with business identity. Six existing structured offering templates plus General are reused; this does not implement or redefine the 171 economic categories. Each product retains its individual category, options, variants and exact IDs.

The existing PUT profile contract saves category and model as owner facts only. Existing profile extensions and exact product/media identities remain intact. Incoming grant or review fields cannot become server authority. Model choice never grants selling, publication, merchant or payment permission. Marketing guidance states £149 per month and direct approved business continuation; selling is preparation only.

The same PUT route supports private submission of a complete, confirmed saved profile. Ownership is rechecked and SQL compares the reviewed snapshot atomically. Unchanged reviewed information stays retryable after transport/server failures, including a lost successful response; browser regression verifies the same submission timestamp after retry. A stale snapshot response requires saving and reviewing again. Both sequential and overlapping identical submissions retain the same timestamp; atomic SQL compares all saved facts and confirmation metadata while allowing only the server submission metadata to differ; stale or incomplete snapshots and unauthorized owners are rejected. Edits return submission status to private draft. Submission is recorded in the existing business profile informationStatus, without another store or category database. Business approval is not asserted. No administrative review or selling activation was built.

New preparation guidance uses the existing nine-language registry, selector and category labels. Business facts are not translated. Legacy profile input labels, continuation/fulfilment labels, authentication screens, surrounding Overview/Marketing/Results copy and server validation errors remain English and are explicitly not claimed as fully localized.

## Verification

Local complete Node suite and real isolated PGlite/API submission test cover ownership isolation, incomplete applications, invalid categories/models, spoofed grants, stale snapshots, duplicate submission, edit invalidation and exact category preservation. Browser gate additionally exercises a new isolated owner from Overview to My Business, save, review, private submission, return navigation, all nine new guidance languages and 390/820/1440 widths. Existing owner/product/media/private marketing/Results/sign-out and full Customer Experience browser gates remain required.

Engineering identity adapters run only in the isolated test process; production Clerk authentication is not replaced. Local Chrome startup is blocked by the execution environment's socket restrictions. GitHub Chrome workflow and its rendered artifacts are the required browser evidence. No genuine production account, business, test data, publication, external AI or payment activation is permitted.

Release gate: all required workflows pass on the exact final head; source and rendered review complete with no unresolved findings; preview READY; production READY for the exact merge commit. Remaining production prerequisites are genuine configured provider sign-in and owner usability validation, later administrative review/approval and separate merchant/purchase authorization. Provider sign-in is not claimed by isolated engineering tests.
