const assert = require("node:assert/strict");
const test = require("node:test");
const { excludedCustomerTerms } = require("../api/_lib/customer-possibility-contract.js");

test("explicit customer exclusions are extracted without treating them as preferences", function () {
  assert.deepEqual(Array.from(excludedCustomerTerms("I want dinner without peanuts and no alcohol")).sort(), ["alcohol", "peanuts"]);
  assert.deepEqual(Array.from(excludedCustomerTerms("I want a bicycle repair")).sort(), []);
});

test("exclusion terms are not inferred from unrelated words", function () {
  assert.deepEqual(Array.from(excludedCustomerTerms("I need a quiet meal for two")).sort(), []);
});
