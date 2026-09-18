const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const customer = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");

test("customer product discovery has explicit details without manufacturing engagement", function () {
  assert.match(customer, /View details/);
  assert.match(customer, /Viewing it is not recorded as interest or a purchase/);
  assert.match(customer, /customer-product-detail-button/);
});

test("customer product continuation stays named for the providing business", function () {
  assert.match(customer, /Continue with " \+ possibility\.businessName/);
  assert.match(customer, /Contact " \+ possibility\.businessName/);
});

test("unavailable products do not receive a detail continuation action", function () {
  assert.match(customer, /product\.availability !== "unavailable" && href/);
  assert.match(customer, /product is not currently available/);
});
