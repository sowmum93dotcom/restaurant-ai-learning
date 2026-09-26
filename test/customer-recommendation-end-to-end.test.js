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

test("unavailable products do not create a recommendation or appear as relevant products", function () {
  const unavailable = offer("unavailable", "Our services for local customers", "Bicycle repair", "Bicycle servicing");
  unavailable.products[0].availability = "unavailable";
  assert.deepEqual(findCustomerPossibilities(request("bicycle repair"), [unavailable]), []);
  const mixed = offer("mixed", "Bicycle care and repair", "Bicycle repair", "Bicycle servicing");
  mixed.products[0].availability = "unavailable";
  mixed.products.push({
    productId: "available-product", businessId: "business-mixed", name: "Bicycle servicing",
    description: "Cycle maintenance", continuationRoute: "website", customerVisible: true,
    availability: "available"
  });
  const results = findCustomerPossibilities(request("bicycle repair"), [mixed]);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].products.map(product => product.productId), ["available-product"]);
});

test("explicit business unavailability blocks matching while unknown status remains labelled", function () {
  const unavailable = offer("closed", "Bicycle care and repair", "Bicycle repair", "Cycle servicing", {
    operationalAvailability: { status: "unavailable", notes: "Temporarily closed" }
  });
  const contact = offer("ask", "Bicycle care and repair", "Bicycle repair", "Cycle servicing", {
    operationalAvailability: { status: "contact", notes: "Ask business to confirm" }
  });
  const results = findCustomerPossibilities(request("bicycle repair"), [unavailable, contact]);
  assert.deepEqual(results.map(item => item.workItemId), ["ask"]);
  assert.equal(results[0].operationalAvailability.status, "contact");
  assert.notEqual(results[0].operationalAvailability.status, "available");
});

test("customer-facing explanation uses only validated matching terms without promising suitability", function () {
  const { customerRelevanceMessage } = require("../js/customer.js");
  const matches = findCustomerPossibilities(request("I need bicycle repair"), [
    offer("repair-explanation", "Our services for local customers", "Bicycle repair", "Bicycle servicing")
  ]);
  assert.equal(matches.length, 1);
  const message = customerRelevanceMessage(matches[0]);
  assert.match(message, /bicycle/);
  assert.match(message, /repair/);
  assert.match(message, /not confirmation that all your requirements are met/);
  assert.doesNotMatch(message, /guaranteed|fully suitable|available now/i);
});

test("multiple customer requirements are not represented as fully satisfied by partial evidence", function () {
  const { customerRelevanceMessage } = require("../js/customer.js");
  const results = findCustomerPossibilities(request("bicycle repair with home collection and weekend service"), [
    offer("partial-repair", "Bicycle repair and servicing", "Bicycle repair", "Repair service")
  ]);
  assert.equal(results.length, 0);
  const message = customerRelevanceMessage({ relevance: { evidence: ["bicycle", "repair"] } });
  assert.match(message, /Matching evidence/);
  assert.match(message, /not confirmation that all your requirements are met/);
  assert.doesNotMatch(message, /home collection confirmed|weekend service confirmed/i);
});

test("explicit additional requirements need matching business evidence", function () {
  const results = findCustomerPossibilities(request("bicycle repair with home collection and weekend service"), [
    offer("partial", "Bicycle repair service", "Bicycle repair", "Repair service"),
    offer("complete", "Bicycle repair service with home collection and weekend service", "Bicycle repair", "Repair service")
  ]);
  assert.deepEqual(results.map(item => item.workItemId), ["complete"]);
});

test("an exclusion after a with clause is not treated as a positive requirement", function () {
  const results = findCustomerPossibilities(request("dinner with family without peanuts"), [
    offer("safe", "Family dinner", "Family dinner", "Seasonal dishes"),
    offer("unsafe", "Family dinner with peanuts", "Family dinner", "Peanut dishes")
  ]);
  assert.deepEqual(results.map(item => item.workItemId), ["safe"]);
});

test("including and offering clauses require actual public business evidence", function () {
  for (const wording of [
    "bicycle repair including home collection and weekend service",
    "bicycle repair offering home collection and weekend service"
  ]) {
    const results = findCustomerPossibilities(request(wording), [
      offer("partial-phrasing", "Bicycle repair service", "Bicycle repair", "Repair service"),
      offer("complete-phrasing", "Bicycle repair including home collection and weekend service", "Bicycle repair", "Repair service")
    ]);
    assert.deepEqual(results.map(item => item.workItemId), ["complete-phrasing"], wording);
  }
});

test("including requirement ends at an explicit exclusion clause", function () {
  const results = findCustomerPossibilities(request("dinner including family seating without peanuts"), [
    offer("safe-seating", "Family dinner with family seating", "Family dinner", "Seasonal dishes"),
    offer("unsafe-seating", "Family dinner with family seating and peanuts", "Family dinner", "Peanut dishes")
  ]);
  assert.deepEqual(results.map(item => item.workItemId), ["safe-seating"]);
});

test("separate products cannot combine to satisfy one explicit multi-feature request", function () {
  const split = offer("split", "Bicycle repair services", "Bicycle repair", "Standard service");
  split.products.push({
    productId: "collection-only", businessId: split.businessId, name: "Home collection",
    description: "Weekend collection service", continuationRoute: "website",
    customerVisible: true, availability: "available"
  });
  const complete = offer("single", "Our services", "Bicycle repair with home collection",
    "Weekend bicycle repair service with home collection");
  const results = findCustomerPossibilities(request("bicycle repair with home collection and weekend service"), [split, complete]);
  assert.deepEqual(results.map(item => item.workItemId), ["single"]);
  assert.ok(results[0].relevance.evidence.includes("collection"));
});

test("a product unavailable for enquiries cannot supply required features", function () {
  const unavailable = offer("unavailable-feature", "Bicycle repair services", "Bicycle repair with home collection",
    "Weekend service");
  unavailable.products[0].availability = "unavailable";
  assert.deepEqual(findCustomerPossibilities(
    request("bicycle repair with home collection and weekend service"), [unavailable]
  ), []);
});

test("result product gallery does not present partial products as full requirement matches", function () {
  const work = offer("gallery", "Bicycle repair with home collection and weekend service",
    "Bicycle repair with home collection", "Weekend service");
  work.products.push({
    productId: "partial-product", businessId: work.businessId, name: "Bicycle repair",
    description: "Standard workshop service", continuationRoute: "website",
    customerVisible: true, availability: "available"
  });
  const results = findCustomerPossibilities(request("bicycle repair with home collection and weekend service"), [work]);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].products.map(product => product.productId), ["product-gallery"]);
});

test("business-copy match does not attach unrelated partial product continuations", function () {
  const work = offer("copy-only", "Bicycle repair with home collection and weekend service",
    "Bicycle repair", "Standard workshop service");
  const results = findCustomerPossibilities(request("bicycle repair with home collection and weekend service"), [work]);
  assert.equal(results.length, 1);
  assert.equal(Object.hasOwn(results[0], "products"), false);
});

test("ordinary requests cannot be matched by stitching together unrelated products", function () {
  const split = offer("ordinary-split", "Explore our services", "Garden accessories", "Accessories only");
  split.products.push({
    productId: "repair-only", businessId: split.businessId, name: "Repair tools",
    description: "Workshop supplies", continuationRoute: "website",
    customerVisible: true, availability: "available"
  });
  const complete = offer("ordinary-complete", "Explore our services", "Garden repair", "Garden repair service");
  assert.deepEqual(findCustomerPossibilities(request("garden repair"), [split, complete])
    .map(item => item.workItemId), ["ordinary-complete"]);
});

test("a generic business headline does not borrow evidence from separate products", function () {
  const split = offer("headline-split", "Garden accessories", "Repair tools", "Workshop supplies");
  assert.deepEqual(findCustomerPossibilities(request("garden repair"), [split]), []);
});
