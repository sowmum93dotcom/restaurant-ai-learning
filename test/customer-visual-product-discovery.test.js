const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const customer = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");

test("customer product discovery presents product information directly without an extra details step", function () {
  assert.doesNotMatch(customer, /customer-product-detail-button/);
  assert.doesNotMatch(customer, /View details/);
  assert.match(customer, /Image and product information provided by/);
  assert.match(customer, /possibility\.businessName/);
});

test("customer product continuation uses one simple Buy action while retaining exact product and business identity", function () {
  assert.match(customer, /continueAction\.textContent = "Buy"/);
  assert.match(customer, /"Buy " \+ product\.name \+ " from " \+ possibility\.businessName/);
});

test("unavailable products do not receive a detail continuation action", function () {
  assert.match(customer, /product\.availability !== "unavailable" && href/);
  assert.match(customer, /product is not currently available/);
});


test("product experiences keep Buy primary instead of rendering competing business continuation actions", function () {
  assert.match(customer, /const hasProductExperience = Array\.isArray\(possibility\.products\) && possibility\.products\.length > 0/);
  assert.match(customer, /possibility\.customerContinuation && !hasProductExperience/);
});
