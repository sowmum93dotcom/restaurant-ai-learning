// Server-side eligibility predicate only. No checkout session is created here.
// Inputs must be loaded from authoritative server records, never public work or browser claims.
const COMMISSION_BASIS_POINTS = 700;
function required(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function checkoutReadiness(context) {
  const blocked = (reason) => ({ eligible: false, reason });
  if (!context || typeof context !== "object" || Array.isArray(context)) return blocked("missing-context");
  const { vendor, product, paymentAccount, transaction } = context;
  if (!vendor || !required(vendor.id) || vendor.commercialArrangement !== "commission" ||
      vendor.approvalStatus !== "approved" || vendor.sellerStatus !== "verified") return blocked("vendor-not-approved");
  if (!paymentAccount || paymentAccount.vendorId !== vendor.id ||
      paymentAccount.status !== "ready" || !required(paymentAccount.providerAccountId)) return blocked("payment-account-not-ready");
  if (!product || !required(product.id) || product.vendorId !== vendor.id ||
      product.approvalStatus !== "approved" || product.availability !== "available" ||
      product.customerVisible !== true) return blocked("product-not-approved");
  if (!Number.isSafeInteger(product.priceMinor) || product.priceMinor <= 0 ||
      !/^[A-Z]{3}$/.test(product.currency || "")) return blocked("invalid-price");
  if (!transaction || transaction.vendorId !== vendor.id || transaction.productId !== product.id ||
      transaction.priceMinor !== product.priceMinor || transaction.currency !== product.currency ||
      transaction.commissionBasisPoints !== COMMISSION_BASIS_POINTS ||
      transaction.fulfilmentConfirmed !== true || transaction.sellerDisclosuresReady !== true) return blocked("transaction-not-verified");
  return { eligible: true, reason: "ready" };
}
module.exports = { checkoutReadiness, COMMISSION_BASIS_POINTS };
