const assert = require("node:assert/strict");
const test = require("node:test");
const { checkoutReadiness } = require("../api/_lib/customer-checkout-readiness.js");

function approved() {
  return {
    vendor: { id: "vendor-a", commercialArrangement: "commission", approvalStatus: "approved", sellerStatus: "verified" },
    paymentAccount: { vendorId: "vendor-a", status: "ready", providerAccountId: "provider-account" },
    product: { id: "product-a", vendorId: "vendor-a", approvalStatus: "approved", availability: "available", customerVisible: true, priceMinor: 10000, currency: "GBP" },
    transaction: { vendorId: "vendor-a", productId: "product-a", priceMinor: 10000, currency: "GBP", commissionBasisPoints: 700, fulfilmentConfirmed: true, sellerDisclosuresReady: true }
  };
}
test("checkout readiness requires complete verified server context", () => {
  assert.deepEqual(checkoutReadiness(approved()), { eligible: true, reason: "ready" });
  assert.equal(checkoutReadiness(null).eligible, false);
  assert.equal(checkoutReadiness({ commercialMode: "commission", paymentReady: true, checkoutUrl: "https://example.com" }).eligible, false);
});
test("marketing only, unapproved seller and unready payment account cannot checkout", () => {
  for (const change of [
    c => { c.vendor.commercialArrangement = "marketing"; },
    c => { c.vendor.approvalStatus = "pending"; },
    c => { c.vendor.sellerStatus = "unverified"; },
    c => { c.paymentAccount.status = "pending"; },
    c => { c.paymentAccount.vendorId = "another-vendor"; }
  ]) { const c = approved(); change(c); assert.equal(checkoutReadiness(c).eligible, false); }
});
test("product, price and transaction mismatches fail closed", () => {
  for (const change of [
    c => { c.product.availability = "unavailable"; },
    c => { c.product.customerVisible = false; },
    c => { c.product.vendorId = "another-vendor"; },
    c => { c.product.priceMinor = 0; },
    c => { c.product.priceMinor = 10.5; },
    c => { c.product.currency = "£"; },
    c => { c.transaction.productId = "another-product"; },
    c => { c.transaction.priceMinor = 9999; },
    c => { c.transaction.currency = "USD"; },
    c => { c.transaction.commissionBasisPoints = 600; },
    c => { c.transaction.fulfilmentConfirmed = false; },
    c => { c.transaction.sellerDisclosuresReady = false; }
  ]) { const c = approved(); change(c); assert.equal(checkoutReadiness(c).eligible, false); }
});
