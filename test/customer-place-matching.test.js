const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCustomerPlace, sameDeclaredPlace, findCustomerPossibilities } = require("../api/_lib/customer-possibility-contract.js");
const { buildCustomerUnderstanding, confirmCustomerUnderstanding } = require("../js/customer-understanding.js");
test("place validation accepts only a bounded customer-supplied location", () => {
  assert.equal(validateCustomerPlace({ understanding: {}, place: " London " }), "London");
  assert.equal(validateCustomerPlace({ understanding: {} }), "");
  for (const place of ["", "x".repeat(81), "London;drop", 44, "<script>"]) assert.equal(validateCustomerPlace({ place }), null);
});
test("exact declared place is not inferred proximity", () => {
  assert.equal(sameDeclaredPlace("London", " london "), true);
  assert.equal(sameDeclaredPlace("London", "Greater London"), false);
  assert.equal(sameDeclaredPlace("London", undefined), false);
});
test("optional place filters only authorized matching work and does not affect default", () => {
  const understanding = confirmCustomerUnderstanding(buildCustomerUnderstanding("Eat & enjoy", "quiet dinner"));
  const work = ["London", "Paris", undefined].map((location, i) => ({
    workItemId: "place-" + i, businessName: "Place " + i,
    content: "Quiet dinner and restaurant meal", participationAction: "Interested", location
  }));
  const all = findCustomerPossibilities(understanding, work);
  const london = findCustomerPossibilities(understanding, work, undefined, [], [], "London");
  assert.ok(all.length > london.length);
  assert.equal(london.length, 1);
  assert.equal(london[0].location, "London");
});
