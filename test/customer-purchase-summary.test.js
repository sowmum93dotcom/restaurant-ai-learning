const assert = require("node:assert/strict");
const test = require("node:test");
const { preparePurchaseSummary } = require("../api/_lib/customer-purchase-summary.js");
function approved() {
  return {
    vendor: { id: "v1", commercialArrangement: "commission", approvalStatus: "approved", sellerStatus: "verified", legalSellerName: "Example Seller Ltd" },
    paymentAccount: { vendorId: "v1", status: "ready", providerAccountId: "account" },
    product: { id: "p1", vendorId: "v1", approvalStatus: "approved", availability: "available", customerVisible: true, priceMinor: 10000, currency: "GBP", name: "Product" },
    transaction: { vendorId: "v1", productId: "p1", priceMinor: 10000, currency: "GBP", commissionBasisPoints: 700,
      fulfilmentConfirmed: true, sellerDisclosuresReady: true, fulfilmentDescription: "Delivery in three days",
      refundTerms: "Contact seller for returns", sellerContact: "seller@example.com",
      deliveryMinor: 500, taxMinor: 0, totalMinor: 10500 }
  };
}
test("purchase summary returns exact verified customer information without private payment fields", () => {
  const result = preparePurchaseSummary(approved());
  assert.equal(result.ready, true);
  assert.deepEqual(result.summary, {
    sellerName: "Example Seller Ltd", sellerContact: "seller@example.com", productName: "Product",
    currency: "GBP", itemPriceMinor: 10000, deliveryMinor: 500, taxMinor: 0, totalMinor: 10500,
    fulfilment: "Delivery in three days", refundTerms: "Contact seller for returns"
  });
  assert.doesNotMatch(JSON.stringify(result), /providerAccountId|commissionBasisPoints|checkoutUrl/);
});
test("purchase summary fails closed on absent disclosures, inconsistent totals and ineligible vendors", () => {
  for (const change of [
    c => { c.vendor.legalSellerName = ""; },
    c => { c.product.name = ""; },
    c => { c.transaction.sellerContact = ""; },
    c => { c.transaction.refundTerms = ""; },
    c => { c.transaction.fulfilmentDescription = ""; },
    c => { c.transaction.totalMinor = 10499; },
    c => { c.transaction.deliveryMinor = -1; },
    c => { c.transaction.taxMinor = 1.5; },
    c => { c.product.priceMinor = Number.MAX_SAFE_INTEGER; c.transaction.priceMinor = Number.MAX_SAFE_INTEGER; c.transaction.totalMinor = Number.MAX_SAFE_INTEGER + 500; },
    c => { c.vendor.commercialArrangement = "marketing"; }
  ]) { const c = approved(); change(c); assert.equal(preparePurchaseSummary(c).ready, false); }
});
