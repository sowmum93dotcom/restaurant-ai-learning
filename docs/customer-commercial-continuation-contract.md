# DEMEOS Customer Experience — Commercial Continuation Contract

Status: Architecture decision; no live payment functionality authorised.
Scope: AREA 1 Customer Experience. The existing £149 monthly Marketing Agent arrangement remains unchanged.

## Approved commercial arrangements

1. Marketing only: £149 monthly. Applies to restaurants, food services, and any other business selecting marketing only. The customer pays the business directly. DEMEOS does not process that sale or deduct a sales commission.
2. Commission-enabled selling: an eligible approved vendor can offer a DEMEOS-facilitated checkout. A regulated marketplace payment provider processes the customer's single payment and allocates the agreed fixed 7% commission to DEMEOS and the vendor proceeds to the vendor. The full sale amount must not be represented as DEMEOS commission revenue merely because the checkout is facilitated by DEMEOS.

These arrangements are business-side rules, not customer-facing jargon. The customer sees a clear approved continuation such as “Go to business” or “Buy now” when genuinely available.

## Safe customer continuation

- Marketing only: preserve the existing validated business route and never invent a DEMEOS checkout.
- Commission-enabled: only display Buy now after server-side verification of approved vendor arrangement, payment account readiness, exact available product, price/currency, seller identity, fulfilment information, and a server-created checkout session for that exact transaction.
- Missing, unapproved, inconsistent or stale data: no Buy now; display honest information or an approved non-payment route only where independently authorised.
- Never trust a client-supplied commercial mode, commission amount, checkout URL, price or account identifier as authority. Server must verify against approved records. No untrusted external checkout URL.
- Payment success must be confirmed server-side from the provider; a browser redirect alone is not proof of payment.
- Vendor is identified as the seller unless an explicitly reviewed legal agreement establishes otherwise. Display total customer price and relevant delivery, refund and contact information before payment.
- Keep payment provider credentials and payment operations server-side. Do not introduce payment collection into Discover media or view-only test content.

## Allocation and refund principle

For a £100 eligible sale, illustrative allocations are £93 vendor and £7 DEMEOS, before separately assigned processing fees and applicable tax treatment. A full £100 refund reverses the corresponding vendor allocation and DEMEOS £7 commission through one coordinated provider transaction; a £40 partial refund reverses £37.20 vendor allocation and £2.80 commission, subject to the agreed refund rules and provider capabilities. Do not promise refund success until the provider confirms it. Define processing fees, chargebacks, disputes and negative balances contractually.

## Accounting and regulatory boundary

Only the commission is intended as DEMEOS's revenue under the proposed agency/marketplace arrangement. The split alone does not determine revenue recognition, VAT, corporation tax or the legal seller. Confirm contracts, provider flow, supported jurisdictions and tax treatment with qualified advisers before launch. Do not route gross customer proceeds through an ordinary DEMEOS bank account for onward manual payment.

## Development sequence

1. Preserve and test the current marketing-only continuation.
2. Define and validate an authoritative server-side commercial arrangement and payment readiness contract.
3. Add controlled, clearly labelled non-transactional customer states and tests; never display a live Buy now without a working provider-backed session.
4. Select and verify the regulated provider, seller onboarding, allocation, refund and reconciliation contracts.
5. Build and test server-side checkout and refund operations, including failure, replay and mismatch handling.
6. Only then expose live commission checkout in Customer Experience after production checks and explicit approval.

No payment provider selected, no live checkout or refund integration implemented, and no change to the current £149 arrangement in this document.
