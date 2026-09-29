# Commission checkout provider acceptance gates

Status: planning contract only. No provider selected, account connected, or payment enabled.

## Scope and separation

The existing £149/month marketing-only arrangement continues to use approved business continuation; it does not enter DEMEOS checkout. Commission-selling is a separate approved arrangement with a fixed 7% DEMEOS share and 93% vendor share of the agreed commissionable sale basis. No payment claims from public Discover work may authorize checkout.

## Required provider evidence before implementation

1. Supports the intended countries, currencies, business categories, and verified seller onboarding. Record the legal contracting entity and the seller/merchant-of-record model for each operating territory.
2. Supports a single customer payment with a documented 7%/93% allocation and appropriate settlement to the vendor, without treating the full sale as an ordinary DEMEOS bank receipt. Record the actual provider fee allocation and any minimum, rounding, or settlement constraints.
3. Supports full and partial refunds, including reversal of the platform share and vendor share, and documents fees that are not returned.
4. Documents disputes, chargebacks, reserves, negative balances, failed payouts, seller suspension, and who bears each liability.
5. Provides server-created transaction-specific checkout sessions, authenticated event notifications, idempotency/replay handling, and a reliable reconciliation path. Browser success alone must never mark an order paid.
6. Supports clear customer disclosure of legal seller, product, delivery, taxes, final total, contact, and refund terms before payment.
7. Meets applicable security, privacy, records, tax-reporting, and accounting requirements for each launch jurisdiction; obtain professional legal and tax review where needed.
8. Can be tested in a non-live environment, including success, failure, duplicate events, partial/full refunds, payout failures, and seller account loss.

## Activation gate

Do not expose Buy Now or create a live checkout until a provider is explicitly selected and approved, the authoritative server-side arrangement and readiness are wired to verified records, a checkout/order state machine is implemented, refund/dispute and reconciliation tests pass, and deployment is reviewed. Existing approved marketing continuation remains the fallback for marketing-only businesses. Do not invent a provider, checkout URL, seller approval, or payment readiness.
