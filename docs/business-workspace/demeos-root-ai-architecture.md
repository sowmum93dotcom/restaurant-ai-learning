# DEMEOS ROOT AI — independent application and intelligence boundary

Status: architecture contract for phased implementation in draft PR #708. **Not a claim that the standalone application is built or live.** No Production activation is authorised.

## Purpose and ownership

ROOT AI is an independent DEMEOS-controlled intelligence **product and service**. It can serve the DEMEOS Selling and Marketing applications, independent businesses that are not DEMEOS marketplace vendors, and other authorised platforms. ROOT is not a page within Selling and Selling is not a prerequisite for ROOT access. Do not rename an existing vendor feature to ROOT and claim standalone delivery.

DEMEOS controls service orchestration, private execution configuration, permissions, data handling, grounded verification, evaluation, audit records, and model version selection. Current Qwen3-VL-4B-Instruct weights are externally authored, self-hosted in a controlled GPU container, **not** trained from scratch by DEMEOS. Provider-supplied compute and networking are not DEMEOS-owned physical infrastructure. No hosted third-party AI inference API is authorised for the core product workflow.

## Required boundaries

1. **ROOT app:** separate entry point, authentication and workspace for standalone customers. A vendor account is optional, not required. Do not make the Selling Dashboard the home for ROOT.
2. **ROOT service:** server-to-server, explicitly authorised, versioned requests. Resolve the real principal, organisation and scope on the server. Reject implicit trust based on URL, browser flags, email similarity, or membership in another DEMEOS product.
3. **Clients:** Selling, Marketing and future external platforms use scoped capabilities through explicit integration. Each remains independently owned and deployed. Do not clone dashboards or duplicate the category registry.
4. **Data:** strictly tenant-bound records, independent consent, retention, billing and revocation decisions. Neither a ROOT user nor a DEMEOS vendor inherits access to another workspace. External client access requires a separate policy and credential lifecycle.
5. **Execution:** reuse the reviewed local visual-runtime components and existing durable budget/provenance controls where suitable; do not introduce a second ungoverned GPU executor. Keep licence review, egress restrictions, encrypted transport, deadlines, tenant budgets, signed request evidence and model/version provenance.
6. **Reliability:** unavailable runtime must return an explicit unavailable/error state, never fictional AI output. Keep generated proposals advisory: no autonomous price, inventory, publication or customer-data changes.
7. **Evaluation:** acceptance requires actual inference quality and latency evidence per supported capability/language, security isolation tests, operating-cost measurement, and verified stop/recovery behaviour—not simply Vercel READY status.

## Phases and gates

**Phase 0 — existing foundations (partial):** PR #708 includes the existing 171-category rules, guarded Selling integration and private GPU runtime. These are foundations, not a complete ROOT product. Preserve and audit them; do not delete or rewrite.

**Phase 1 — independent service identity:** define ROOT-owned tenant, principal, scope, product-agnostic request/response and audit contracts. Introduce no new data persistence until migration and Preview isolation review pass. Default deny all external clients.

**Phase 2 — standalone interface:** separately routed ROOT workspace with its own entry and authorised business onboarding. Reuse sign-in only when explicitly scoped identities remain separate. Provide an optional **Open ROOT AI** entry in Selling that transfers through a reviewed permission flow. No parallel Selling dashboard.

**Phase 3 — controlled intelligence:** integrate verified model execution, image/video analysis, multilingual evaluation and server-side evidence checks. The existing 171-category pipeline remains authoritative for DEMEOS product classification, not a universal taxonomy imposed on independent ROOT customers.

**Phase 4 — external platform access:** explicit per-client authorisation, least-privilege credential management, quotas, tenant separation and documented API compatibility. Launch only after Preview penetration/isolation, abuse, recovery and billing acceptance.

## Non-negotiable release checks

- Standalone ROOT account opens ROOT without a marketplace-vendor identity.
- Selling vendor can open ROOT by an authorised handoff, but that handoff does not grant ROOT access to another business.
- No cross-tenant leakage in logs, caches, storage, jobs or results.
- No third-party hosted inference fallback.
- No automatic write-back to vendor catalogue, prices, stock or publication.
- Measured real inference on the approved runtime; preserved model weights and data; spending within owner-approved cap.
- Separate Preview and Production deployments, test businesses blocked in Production, and explicit approval before enabling live execution.

This contract intentionally adds **no** customer-facing routes, database tables, GPU resource, paid service or Production configuration on its own.


## ROOT network-wide integration contract — 22 October 2026

ROOT is one independent intelligence service for DEMEOS vendors, DEMEOS future Customer Experience, Marketing and Admin systems, and independent businesses or customers. Its service and standalone application must not depend on those unfinished interfaces. Selling is only one optional client.

**Distinct principals:** ROOT personal Business and Customer modes are personal contexts and are not proof of legal organisation membership; Selling vendor authority requires checked Selling ownership; future Marketing, Customer Experience, Admin, business-team and external platform client identities require separately reviewed, disabled-by-default grants. ROOT must reject all unapproved app-to-app requests.

**Network service:** Provide a versioned, server-side request envelope binding authenticated principal, client, audience, consent, capability, resource, tenant scope and policy version. Verify authorisation at ROOT; never trust browser claims or an unverified inherited vendor role. Enforce tenant segregation in storage, GPU jobs, logs and caches; rate limits; replay protection; audit trails; revocation; and provenance. Return independent evidence separately from unverified model suggestions. Never perform unauthorised catalogue, price, stock, order or publication writes. Unavailable model execution must remain explicitly unavailable.

**Development order:** (1) review and specify ROOT shared capability contracts; (2) implement server-side identity and grants with cross-tenant denial tests; (3) verify standalone non-vendor access; (4) preserve and use existing Selling handoff while preparing future separate Marketing/Customer/Admin integrations; (5) perform genuine image-to-GPU-to-private-ROOT-result-to-review acceptance with the one existing model executor; (6) expand verified Business and Customer tools across the authoritative 171 categories. Do not build another dashboard or category registry or treat 171-category listing as completed tools.

**Compute preflight:** Preserve the existing pinned Qwen3-VL-4B model and RunPod Global volume dizzy_indigo_worm. Prefer one available 48 GB L40 or RTX A6000 for initial acceptance if it can attach the existing model volume; the quote, availability and region must be checked live. Check both GPU providers' balances, all stopped/running allocations, cumulative charges, model hashes, disk/network costs and exact owner budget before paid activation. Previous approval limits were $0.90/hour and $35 cumulative evaluation. A general statement that money is not a problem is not a numeric new spending authorisation; obtain a new explicit cap before exceeding the previous limit. Do not auto-create pods, pay, delete stored data, merge or deploy to Production.
