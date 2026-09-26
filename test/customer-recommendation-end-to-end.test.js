const assert = require("node:assert/strict");
const test = require("node:test");
const { findCustomerPossibilities } = require("../api/_lib/customer-possibility-contract.js");
const { buildCustomerUnderstanding, confirmCustomerUnderstanding } = require("../js/customer-understanding.js");

function request(text) {
  return confirmCustomerUnderstanding(buildCustomerUnderstanding("", text));
}
function offer(id, content, productName, productDescription, options = {}) {
  return {
    workItemId: id, businessId: "business-" + id, businessName: "Example business",
    content, participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://example.com/" + id },
    products: [{
      productId: "product-" + id, businessId: "business-" + id,
      name: productName, description: productDescription,
      continuationRoute: "website", customerVisible: true, availability: "available"
    }],
    ...options
  };
}

test("real matcher finds an authorized product despite a generic campaign headline", function () {
  const results = findCustomerPossibilities(request("I need bicycle repair"), [
    offer("repair", "Our services for local customers", "Bicycle repair", "Bicycle maintenance and servicing"),
    offer("dinner", "Our services for local customers", "Family dinner", "Evening meals")
  ]);
  assert.deepEqual(results.map(item => item.workItemId), ["repair"]);
  assert.equal(results[0].products[0].name, "Bicycle repair");
  assert.ok(results[0].relevance.evidence.length);
});

test("explicit exclusions prevent a recommendation when only product details mention the excluded item", function () {
  const results = findCustomerPossibilities(request("Dinner without any peanuts or dairy"), [
    offer("peanut", "A relaxed dinner", "Dinner menu", "Peanuts served with dinner"),
    offer("dairy", "A relaxed dinner", "Dinner menu", "Dairy desserts"),
    offer("plain", "A relaxed dinner", "Dinner menu", "Fresh seasonal dishes")
  ]);
  assert.deepEqual(results.map(item => item.workItemId), ["plain"]);
});

test("invalid or non-public products cannot create positive evidence", function () {
  const hidden = offer("hidden", "Our services for local customers", "Bicycle repair", "Bicycle servicing");
  hidden.products[0].customerVisible = false;
  const wrongBusiness = offer("wrong", "Our services for local customers", "Bicycle repair", "Bicycle servicing");
  wrongBusiness.products[0].businessId = "unrelated-business";
  const noRoute = offer("route", "Our services for local customers", "Bicycle repair", "Bicycle servicing");
  noRoute.products[0].continuationRoute = "booking";
  assert.deepEqual(findCustomerPossibilities(request("bicycle repair"), [hidden, wrongBusiness, noRoute]), []);
});

test("excluded words never become positive product evidence", function () {
  const results = findCustomerPossibilities(request("Dinner without peanuts"), [
    offer("only-peanut", "Our services for local customers", "Peanuts", "Peanuts and nuts")
  ]);
  assert.deepEqual(results, []);
});
