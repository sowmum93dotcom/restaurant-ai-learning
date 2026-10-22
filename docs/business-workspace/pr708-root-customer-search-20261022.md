# ROOT Customer search handoff — 22 October 2026

Status: implemented in the existing PR #708 branch; deployed browser acceptance pending. Native GPU acceptance is still incomplete and disabled. No merge or Production change.

## User flow and application boundary

In the independent ROOT application's Customer mode, a user enters a request, sees its canonical Customer Experience understanding, explicitly confirms sharing, and searches the existing DEMEOS catalogue. ROOT displays published matches or an honest empty result and links to the existing Customer Experience for participation, availability and ordering. It creates no parallel marketplace dashboard, search engine, registry or intelligence executor. Business mode does not expose this Customer action.

ROOT authenticates the caller and requires the Customer audience, explicit current confirmation, a supported locale and bounded supplied text. The server constructs the confirmed understanding with the existing customer-understanding module. It delegates to api/customer/possibilities.js, which retains independent identity resolution, public-catalogue validation, customer privacy/history decisions, issuance, existing semantic interpretation, deterministic constraints and guarded ranking. The default reviewed search configuration remains unchanged; no hosted inference provider is installed.

No browser-selected tenant, business, customer identity, mode, provider, executor or category override is accepted. The delegated request has no catalogue test query and strips both controlled-demo headers. Empty real catalogues remain empty rather than becoming fictional matches. ROOT does not pass its personal workspace identity as Customer Experience authority. That application independently verifies the same caller's existing credential and continues excluding vendor owners from customer history. Existing opt-in preferences/feedback controls remain authoritative.

ROOT renders public result text with textContent, without returned tenant IDs, hidden ranking metadata or generated availability claims. Changing text, category, locale, workspace or selected saved work clears prior results and confirmation. A stale response cannot render in a different request/context. Search is explicit and does not start a GPU job or save a model result in ROOT.

## Validation so far

38 focused Node tests passed, covering the new real-handler delegation, original ROOT permissions/persistence/Selling checks, existing public catalogue, search semantics and guarded ranking. New checks demonstrate: unconfirmed/Business/foreign-authority requests never delegate; the existing handler independently resolves its customer identity; budget and unavailability constraints remove ineligible offers; public responses omit private business IDs; preference and feedback stores are not read without their controls; vendor owners do not gain customer history; empty catalogues cannot enable demo fallback; and denied/malformed/failed delegates fail closed without leaking internal details.

The existing Chromium/WebKit ROOT HTTP/browser gate now exercises the shipped UI through the real existing search handler using explicitly named catalogue/auth fixtures. It checks consent, bounded eligible matches, empty results, context invalidation and all ten interface locales at 375/820/1440 px. Fixture browser evidence is distinct from deployed sign-in, real customer data, native GPU execution and fluent human language review. Browser gate results and signed-in Preview evidence must be recorded after deployment; do not treat this document or a READY deployment as acceptance.

## Unchanged remaining work

The original-image external native path exceeded the existing two-second deadline; zero native ROOT results were saved. Paid compute was stopped with models, Global volume and reports retained. Smaller-image diagnostics and reconciliation of the single expired Preview ledger claim remain blocked by automatic approval review pending explicit approval. Separate external-account live isolation and the remaining network-wide capability journeys remain incomplete.
