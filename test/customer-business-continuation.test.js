const test = require("node:test");
const assert = require("node:assert/strict");
const { toPublicCustomerWorkItem } = require("../api/_lib/customer-public-work-contract.js");
const { findCustomerPossibilities } = require("../api/_lib/customer-possibility-contract.js");

test("public customer work carries only approved continuation and fulfilment fields", function () {
  const item = toPublicCustomerWorkItem({
    workItemId: "work-1", businessName: "Example Bakery", content: "Birthday cake for a celebration",
    participationAction: "Interested", location: "Croydon",
    customerContinuation: { routes: ["website", "phone", "visit", "evil"], website: "https://example.test/order", phone: "02070000000", secret: "no" },
    fulfilment: { methods: ["collection", "delivery", "teleport"], notes: "Collection after confirmation." },
    informationSource: "business-provided"
  });
  assert.deepEqual(item.customerContinuation, { routes: ["website", "phone", "visit"], website: "https://example.test/order", phone: "02070000000" });
  assert.deepEqual(item.fulfilment, { methods: ["collection", "delivery"], notes: "Collection after confirmation." });
  assert.equal(item.informationSource, "business-provided");
  assert.equal(item.customerContinuation.secret, undefined);
});

test("matched possibility keeps continuation separate from Interested evidence", function () {
  const understanding = { intention: "Spend time together", customerText: "birthday cake celebration", understanding: "x", source: "customer-provided", confidenceState: "confirmed" };
  const work = [{
    workItemId: "work-1", businessName: "Example Bakery", content: "Birthday cake for your celebration",
    participationAction: "Interested",
    customerContinuation: { routes: ["phone"], phone: "02070000000" },
    fulfilment: { methods: ["collection"] }, informationSource: "business-provided"
  }];
  const possibility = findCustomerPossibilities(understanding, work)[0];
  assert.equal(possibility.participationAction, "Interested");
  assert.deepEqual(possibility.customerContinuation, { routes: ["phone"], phone: "02070000000" });
  assert.deepEqual(possibility.fulfilment, { methods: ["collection"] });
  assert.equal(possibility.informationSource, "business-provided");
  assert.equal(Object.hasOwn(possibility, "sale"), false);
  assert.equal(Object.hasOwn(possibility, "purchase"), false);
});

test("quote continuation is exposed only when a real customer route can carry the enquiry", function () {
  const actionable = toPublicCustomerWorkItem({
    workItemId: "work-quote", businessName: "Example", content: "Made to order cakes",
    customerContinuation: { routes: ["quote", "email"], email: "orders@example.test" }
  });
  assert.deepEqual(actionable.customerContinuation.routes, ["quote", "email"]);
  assert.equal(actionable.customerContinuation.quoteVia, "email");

  const inert = toPublicCustomerWorkItem({
    workItemId: "work-inert", businessName: "Example", content: "Made to order cakes",
    customerContinuation: { routes: ["quote"] }
  });
  assert.equal(inert.customerContinuation, undefined);
});
