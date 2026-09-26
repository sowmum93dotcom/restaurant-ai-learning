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

test("possibility matching checks exclusions against product details, not only campaign copy", function () {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "..", "api/_lib/customer-possibility-contract.js"), "utf8");
  assert.match(source, /const productTerms = meaningfulTerms\(\(Array\.isArray\(work\.products\)/);
  assert.match(source, /product\.name, product\.description/);
  assert.match(source, /hasExcludedEvidence\(excludedTerms, contentTerms\) \|\| hasExcludedEvidence\(excludedTerms, productTerms\)/);
});

test("understands explicit alternatives and modifiers without excluding positive requests", function () {
  assert.deepEqual(Array.from(excludedCustomerTerms("Dinner without any peanuts or dairy")).sort(), ["dairy", "peanuts"]);
  assert.deepEqual(Array.from(excludedCustomerTerms("Food with no added sugar")).sort(), ["sugar"]);
  assert.deepEqual(Array.from(excludedCustomerTerms("Without peanuts and a drink")).sort(), ["peanuts"]);
});

test("validated product evidence contributes to possibility matching", function () {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "..", "api/_lib/customer-possibility-contract.js"), "utf8");
  assert.match(source, /const offerTerms = new Set\(\[\.\.\.contentTerms, \.\.\.productTerms\]\)/);
  assert.match(source, /evidencedConcepts\(customerTerms, terms\)/);
  assert.match(source, /getValidPublicCustomerWork\(repositoryWork\)/);
});
