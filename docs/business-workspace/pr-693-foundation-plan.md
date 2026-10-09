# PR #693 — Business Owner Workspace foundation

Baseline: PR #692 merge e194a63bb1871a0dd45f28bc9d7b2d48c653afbe.

## Approved development sequence
1. Customer Experience foundation (through PR #692).
2. Business Owner Workspace and Management Dashboard.
3. Admin Control completion and publication governance.
4. Controlled real-business onboarding and end-to-end pilot.

## PR #693 scope
Inspect existing business workspace routes, owner permissions, business registration and profile, products/services/media, marketing and results contracts before implementation. Preserve the existing workspace rather than replacing it.

Establish two distinct business operating models within one workspace:
- Marketing products and services: customers continue to the approved business destination; business marketing access currently £149/month.
- DEMEOS purchase: customers use the existing supported DEMEOS purchasing journey; preserve payment architecture and existing business rules.

Business-facing navigation should be simple and professional: Overview, My Business, Products & Services, Marketing, Results. Mobile, tablet and desktop. Navy/gold visual identity. Avoid technical text.

## Future functional gates (not to claim completed by this planning file)
- Guided media upload and truthful marketing draft assistance, with owner review before administrative approval. Do not fabricate product claims or imply external AI is active.
- Owner-scoped product/service/media editing with exact identity and ownership.
- Privacy-safe reporting that distinguishes impressions, views, interest, contact actions and verified sales; no invented analytics.
- Admin approval and public publication only after later control-system readiness.
- Nine-language customer contracts and current security boundaries remain intact.

## Protected boundaries
No Customer Experience redesign, parallel catalogue/search engine, new auth/payment architecture, external semantic provider activation, or public business onboarding. No edits to Admin Panel in this PR.

## Implementation checklist
- [ ] Inspect actual workspace and authoritative contracts; record confirmed completed and missing features.
- [ ] Implement only the smallest safe two-model/dashboard foundation using existing components.
- [ ] Add owner isolation and model-specific navigation regression tests.
- [ ] Check phone/tablet/desktop and existing customer regressions.
- [ ] Require green GitHub checks, Vercel preview and review before merge.
- [ ] Verify production READY after merge; report unfinished scope honestly.
