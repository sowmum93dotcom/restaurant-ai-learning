# Selling Production entry correction

Baseline: PR705 merge 4519349ad92e6d60c6bad0e872c246084905d623.

The approved inspection rendered the existing dashboard/editor templates with verified sample authority. Normal Selling routes still rewrote to the shared Business Applications/Marketing documents. An unapproved owner received an authoritative denial, then the generic renderer removed the Selling theme, offered a return to Business Applications, and legacy CSS concealed even owned onboarding. Inspection acceptance therefore did not prove real Production application access.

Selling routes now use selling-vendor.html and selling-vendor-manage.html, derived from the approved existing templates with identical component IDs, controllers and Selling CSS. No inspection script/bootstrap is included. /selling-vendor/onboarding reuses that management document for an ownership-protected, unscoped business-profile read. Catalogue, media, stock and orders remain guarded by the existing server Selling permission and ready-state client gates. CSS retains the Selling presentation independently of permission, and only dedicated onboarding exposes owned setup while permission is pending. Real grants still require businessProfile.applicationAccess.selling === true, maintained by the existing review service. No approval or owner assignment is fabricated.

Verified Selling-only owners opening legacy bookmarks go to dedicated Selling onboarding when denied; this selects an interface and does not grant authority. Selling navigation no longer links to Business Applications or another operational application. Marketing route destinations and files are unchanged.

Regression coverage: exact Vercel route mappings, no inspection bootstrap, all seven sections, denied themed state without catalogue permission, legacy bookmark ownership matching, actual SQL/API dashboard/editor, denied grants, owned onboarding with protected panels hidden, session restoration and temporary focus failure without navigation, reload, business switching, media gallery, variants, inventory/history/CSV, private orders, sign-out and nine languages at 390/820/1440. Local SQL tests use isolated PGlite and a test identity-provider adapter; they do not constitute authenticated Vercel acceptance.

Release remains conditional on an authenticated real Preview session and successful deployed authorized/denied checks. No Production database, credentials, records, approvals or permissions were changed by this correction.

The real-entry regression also reproduced a Private Orders restoration race: its hidden-workspace observer cleared the selected order context but did not reactivate it when authentication revealed the same verified workspace. The observer now reactivates on reveal, through its existing ready-state and business-ID checks. A focused regression verifies restored loading without a new permission-model event; stale-account/denial tests remain intact.
