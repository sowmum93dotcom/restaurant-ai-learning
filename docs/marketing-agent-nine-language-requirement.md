# DEMEOS Marketing Agent — Nine-language system requirement

Approved scope: the complete Marketing Agent, covering Customer Experience (Discover, I Know What I Want, My DEMEOS), Business Owner Workspace and DEMEOS Admin Panel. This is an explicit system-wide language requirement; implementation and acceptance are tracked per area, without changing economic architecture.

| Code | Interface language | Direction |
| --- | --- | --- |
| en | English | ltr |
| es | Spanish | ltr |
| fr | French | ltr |
| ar | Arabic | rtl |
| pt | Portuguese | ltr |
| zh | Mandarin Chinese (Simplified Chinese interface) | ltr |
| hi | Hindi | ltr |
| de | German | ltr |
| ja | Japanese | ltr |

## Required behaviour

1. One consistent language selector and persisted preference across all three areas. English fallback for missing translations; no blank labels or mixed-language completed screens.
2. Translate all system-owned interface copy: navigation, headings, actions, form labels, placeholders, empty/loading/error/success states, guidance, validation, authentication and accessibility text. Cover both initial HTML and dynamically rendered content.
3. Arabic uses RTL layout, logical spacing and correctly ordered controls; user-entered text and business-provided content retain their own direction and original wording. Do not reverse icons or media without semantic reason.
4. Preserve canonical intent and feedback values, identifiers, permissions, verified business evidence and action payloads regardless of display language.
5. Never silently machine-translate user input, vendor content, business evidence, prices, names or legal text. Explicit future translation features require separate approval and provenance.
6. Verify language switching without page loss or data loss, mobile/tablet/desktop layout, long labels, screen-reader names, focus order and no regression in Discover navigation or continuation.
7. Use a shared catalogue/keys rather than separate inconsistent hard-coded strings in each area. Record translation coverage and tests before claiming a language complete.

## Delivery and acceptance

Current implementation is partial English/French/Arabic in AREA 1; nine-language system coverage is **not complete**. Finish and validate AREA 1 first, then implement the same approved requirement in Owner Workspace and Admin Panel. Keep the final real-business end-to-end acceptance deferred until the complete Marketing Agent is built, as directed. No change to DEMEOS units, SSC, MDVS or other economic mechanisms.
