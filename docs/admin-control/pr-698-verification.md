# PR 698 — private business application review foundation

Baseline: PR 697 merge `203f815e8053d62927c2069037d7f7ed975cd296`; main and the production domain were verified at that READY deployment before development.

## Existing infrastructure reused

The repository has verified Clerk authentication, trusted `demeos-admin` actor contexts and `MANAGE_PLATFORM` authorization, authoritative business profiles, owner isolation, saved category contracts and private application submission. It has no existing rendered Admin Panel or safe business-approval transition. This adds a narrow Admin Control application-review page rather than another administrative authentication or business registry. Its SDK loader and sign-in dialog are the existing owner authentication integration.

## Implemented capabilities

`admin.html` displays private submitted applications in stable pages of 25, owners, identity, activity, authoritative category, preparation intent, continuation destinations, saved completeness and submission time. Details replace the list while reviewing. Server-authorized reviewers can record **Review completed** or **Changes requested** with private notes and explicit confirmation. Neither means business approval. Existing owner responses and guidance display the current revision's status; changes reset submission to draft and require resubmission.

All review and decision paths, including the consolidated API resource route, require a verified provider identity and the existing explicitly trusted administrator role before accessing persistence. Owner and customer roles receive 403; signed-out callers receive 401. Responses are private/no-store. Cross-origin decisions are rejected. Client roles, administrator IDs, extra fields and approval decisions cannot grant authority.

A dedicated audit relation references the existing business registry. Its unique business/revision key prevents duplicate or conflicting decisions. A canonical SHA-256 includes the full authoritative saved profile and submission metadata. An atomic PostgreSQL row lock plus exact saved-profile comparison prevents accepting a stale review during concurrent updates. Audit records retain the verified administrator, decision, exact snapshot/hash, private notes and database timestamp. Identical retries return the original record; conflicting retries cannot overwrite it. No audit mutation or deletion endpoint exists. The screen displays the latest 50 records; the database retains full history. Owners receive only status/time, never private reviewer notes or identity.

## Activation boundaries

Approval remains unavailable because the existing contracts provide no safe authoritative business-approval transition. Review does not change business ownership, publish products/media/campaigns, authorize selling, activate merchant payments, provision roles, enable external AI or open public onboarding. Existing Unapproved content remains private. Marketing and selling permission architecture is unchanged.

## Verification

- Node suite: 1,443 passing tests, including actual disposable PostgreSQL review APIs, trusted provider roles, unauthorized access, owner isolation, exact snapshots, duplicate/conflicting decisions, concurrent revisions, stale decisions, resubmission, pagination, incomplete/orphaned submissions and publication protection.
- Isolated browser gate uses actual owner/review APIs and PostgreSQL with a test-only identity adapter. Phone 390px, tablet 820px and desktop 1440px pass review, pagination, decisions, accurate owner status, revision reset, audit preservation, sign-out, same-user session refresh reauthorization, account switching, complete private DOM removal and nine-language presentation with unchanged authoritative facts.
- Existing owner browser gate passes the five areas, product/media preservation, factual drafts, private onboarding, category contracts and all nine owner-guidance languages at all three widths. Local video codec absence is reported honestly; CI Chrome verifies the existing real playback gate.
- Approved catalogue source/customer continuation browser gate passes all three widths. Customer language, navigation and search regression gates are run separately and in the required Customer Experience Browser Gate.
- The required GitHub baseline and browser workflows include the new review gate. Exact final-head results, independent Codex review and Vercel preview/merge deployment evidence are reported in the PR release record before completion.

## Remaining requirements

A genuine administrator must already have the trusted Clerk role configured through the existing secure provider provisioning process. No role-grant bootstrap is introduced. Controlled tests do not establish genuine production administrator sign-in or real application decisions; production checks remain anonymous and read-only. Preview provider configuration may fail closed where authentication configuration is unavailable. Business approval/activation requires a separately authorized future authoritative contract; product and marketing publication remain separate. All new review guidance supports the existing nine-language registry, while saved business facts remain verbatim and existing legacy owner fields are not newly translated.

Independent Codex review found stale same-user session authorization and hidden private text retention. The listener now clears and reauthorizes on every authentication update; clearing purges all private detail, audit and form fields. Actual SQL/API browser regressions verify refreshed-session access revocation, account switching and empty private DOM fields. Release checks are rerun on the fix commit.
