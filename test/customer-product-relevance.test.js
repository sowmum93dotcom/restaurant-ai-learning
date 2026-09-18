const test = require("node:test");
const assert = require("node:assert/strict");
const { findCustomerPossibilities, meaningfulTerms, productRelevance, relevantProductsForCustomer } =
  require("../api/_lib/customer-possibility-contract.js");

function product(productId, name, description) {
  return { productId, name, description, continuationRoute: "website", availability: "available" };
}

test("product relevance requires defensible current-request evidence", function () {
  const birthday = productRelevance(product("cake", "Chocolate birthday cake", "Chocolate celebration cake for birthdays"),
    meaningfulTerms("I need a chocolate birthday cake"));
  const unrelated = productRelevance(product("bread", "Sourdough loaf", "Fresh artisan bread"),
    meaningfulTerms("I need a chocolate birthday cake"));
  assert.ok(birthday);
  assert.equal(birthday.basis, "current-intention-product-information");
  assert.equal(unrelated, null);
});

test("a matched business does not become an unrelated product catalogue", function () {
  const matches = relevantProductsForCustomer([
    product("cake", "Chocolate birthday cake", "Chocolate cake for a birthday celebration"),
    product("bread", "Sourdough loaf", "Fresh artisan bread"),
    product("coffee", "Coffee beans", "Roasted coffee beans")
  ], meaningfulTerms("chocolate birthday cake"));
  assert.deepEqual(matches.map(function (item) { return item.productId; }), ["cake"]);
  assert.ok(matches[0].relevance.evidence.length > 0);
});

test("business possibility remains valid when none of its products are relevant", function () {
  const work = [{
    workItemId: "work-1", businessId: "business-1", businessName: "Example Bakery",
    content: "Birthday celebration cakes and food for family occasions", participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://example.test" },
    products: [
      { ...product("bread", "Sourdough loaf", "Fresh artisan bread"), businessId: "business-1" },
      { ...product("coffee", "Coffee beans", "Roasted coffee beans"), businessId: "business-1" }
    ]
  }];
  const results = findCustomerPossibilities({
    intention: "Spend time together", customerText: "birthday celebration with family"
  }, work);
  assert.equal(results.length, 1);
  assert.equal(results[0].businessName, "Example Bakery");
  assert.equal("products" in results[0], false);
});

test("relevant public product retains only transparent relevance evidence", function () {
  const work = [{
    workItemId: "work-2", businessId: "business-2", businessName: "Celebration Bakery",
    content: "Birthday celebration cakes and food for family occasions", participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://example.test" },
    products: [{ ...product("cake", "Chocolate birthday cake", "Chocolate cake for birthday celebrations"), businessId: "business-2" }]
  }];
  const results = findCustomerPossibilities({
    intention: "Spend time together", customerText: "chocolate birthday cake for family"
  }, work);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].products.map(function (item) { return item.productId; }), ["cake"]);
  assert.equal(results[0].products[0].relevance.basis, "current-intention-product-information");
});
