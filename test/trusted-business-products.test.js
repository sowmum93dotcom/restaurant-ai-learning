const test = require("node:test");
const assert = require("node:assert/strict");
const { toPublicCustomerWorkItem } = require("../api/_lib/customer-public-work-contract.js");

function work(overrides = {}) {
  return {
    workItemId: "work-1", businessId: "business-a", businessName: "Bella Vista",
    content: "A genuine option for your request.", participationAction: "Interested",
    customerContinuation: { routes: ["website"], website: "https://bella.example/products" },
    products: [{ productId: "cake-1", businessId: "business-a", name: "Celebration cake",
      description: "Chocolate cake made to order.", price: "£45",
      imageUrl: "https://bella.example/images/cake.jpg", imageSource: "business-provided",
      continuationRoute: "website", availability: "available" }],
    ...overrides
  };
}

test("public customer work keeps a product image bound to the same business and route", function () {
  const item = toPublicCustomerWorkItem(work());
  assert.equal(item.products.length, 1);
  assert.equal(item.products[0].businessId, "business-a");
  assert.equal(item.products[0].imageUrl, "https://bella.example/images/cake.jpg");
  assert.equal(item.products[0].continuationRoute, "website");
});

test("a product claiming another business is never published", function () {
  const item = toPublicCustomerWorkItem(work({ products: [{ productId: "other", businessId: "business-b",
    name: "Other brand product", description: "Must not cross business boundaries.",
    imageUrl: "https://other.example/product.jpg", continuationRoute: "website" }] }));
  assert.equal(Object.hasOwn(item, "products"), false);
});

test("unsafe product image URLs are never published", function () {
  const item = toPublicCustomerWorkItem(work({ products: [{ productId: "cake-2", businessId: "business-a",
    name: "Cake", description: "A cake.", imageUrl: "javascript:alert(1)", continuationRoute: "website" }] }));
  assert.equal(Object.hasOwn(item, "products"), false);
});
