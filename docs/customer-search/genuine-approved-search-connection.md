# Genuine approved source connection

PR 689 production was verified READY at merge commit `0e3880a918a49c32f61b5d9a03069f028d337d62`, with `demeos.io` and `www.demeos.io` assigned to that exact deployment before work began.

The existing joined business/campaign records, publication rules, owner profile offers and approved media resolver remain the sole catalogue authority. Products and services use the same owned offer contract. Search uses the existing understanding, category validation, eligibility, ranking and Customer Experience receiver.

The previous 20-record catalogue cut-off occurred before customer eligibility. A relevant published offer beyond those records could never reach search. The server search path now requests at most 200 valid projected records, over pages of 50, inspecting at most 1000 source rows. Category selection and deterministic matching retain that candidate bound, then apply the existing five-result cap after eligibility and ranking. Discover retains its existing 20-record feed. No browser or provider can select the retrieval limits.

These are bounded catalogue windows, not whole-database coverage or customer-facing cursor pagination. A matching record outside the window can still be absent. The source uses the existing updated-at/campaign-ID order and OFFSET pagination; concurrent lifecycle updates between pages are not a transaction snapshot. No new catalogue, storage, approval, indexing or publication mechanism was introduced.

The SQL/browser journey also exposed a receiving bug: a grouped DOM selector chose the earlier campaign headline instead of the business label. Product Experience now selects the explicit business-name nodes in priority order, without treating a generic heading as identity.

Reserved controlled-content identity namespaces and supplied controlled-image paths fail publication inspection even if a stored campaign says Approved. Opt-in controlled content remains in its existing local fallback and never becomes genuine publication authority.

Validation uses isolated engineering rows, including a real PostgreSQL-compatible database in the browser gate. Later-page products/services reach the real HTTP handlers and existing product selection/continuation screen on phone, tablet and desktop. Tests also cover all nine locale values, privacy projection, exclusions, invalid ownership, bounded pagination, empty results, ordering and deterministic fallback. Existing nine-language/browser/security gates remain required. Fixtures are never inserted into deployed databases and are not evidence of actual approved-business accuracy.

External semantic providers remain disabled in the unchanged server configuration. Payment, authentication, Business Owner Workspace, Admin Panel and economic architecture are outside this change.
