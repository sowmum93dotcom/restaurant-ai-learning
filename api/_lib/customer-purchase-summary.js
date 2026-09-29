// Server-side purchase information contract. Does not create or authorize payment.
const { checkoutReadiness } = require("./customer-checkout-readiness.js");
function required(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function preparePurchaseSummary(context) {
  const readiness = checkoutReadiness(context);
  if (!readiness.eligible) return { ready: false, reason: readiness.reason };
  const { vendor, product, transaction } = context;
  const sellerName = required(vendor.legalSellerName);
  const productName = required(product.name);
  const fulfilment = required(transaction.fulfilmentDescription);
  const refundTerms = required(transaction.refundTerms);
  const sellerContact = required(transaction.sellerContact);
  if (!sellerName || !productName || !fulfilment || !refundTerms || !sellerContact) {
    return { ready: false, reason: "missing-purchase-information" };
  }
  const calculatedTotal = product.priceMinor + transaction.deliveryMinor + transaction.taxMinor;
  if (!Number.isSafeInteger(transaction.deliveryMinor) || transaction.deliveryMinor < 0 ||
      !Number.isSafeInteger(transaction.taxMinor) || transaction.taxMinor < 0 ||
      !Number.isSafeInteger(calculatedTotal) ||
      !Number.isSafeInteger(transaction.totalMinor) ||
      transaction.totalMinor !== calculatedTotal) {
    return { ready: false, reason: "invalid-order-total" };
  }
  return {
    ready: true,
    summary: {
      sellerName, sellerContact, productName, currency: product.currency,
      itemPriceMinor: product.priceMinor, deliveryMinor: transaction.deliveryMinor,
      taxMinor: transaction.taxMinor, totalMinor: transaction.totalMinor,
      fulfilment, refundTerms
    }
  };
}
module.exports = { preparePurchaseSummary };
