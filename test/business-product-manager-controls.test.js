const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const client = fs.readFileSync(path.join(__dirname, "..", "js", "script.js"), "utf8");
const api = fs.readFileSync(path.join(__dirname, "..", "api", "businesses", "[businessId].js"), "utf8");
const contract = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "customer-possibility-contract.js"), "utf8");
const publicWork = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "customer-public-work-contract.js"), "utf8");

test("Business Product Manager supports editing without duplicating a product", function () {
  assert.match(client, /edit\.textContent = "Edit"/);
  assert.match(client, /findIndex\(function \(entry\) \{ return entry\.productId === productId; \}\)/);
  assert.match(client, /draftProducts\.splice\(existingIndex, 1, product\)/);
  assert.match(client, /Update product \/ service/);
});

test("owner-controlled product visibility is stored server-side", function () {
  assert.match(api, /customerVisible: item\.customerVisible !== false/);
  assert.match(client, /customerVisible: productFields\.visibility\.value !== "hidden"/);
});

test("hidden products never enter the public customer possibility contract", function () {
  assert.match(contract, /product\.customerVisible !== false/);
  assert.match(publicWork, /product\.customerVisible !== false/);
  assert.match(contract, /delete publicProduct\.customerVisible/);
});

test("removing another product does not discard the product currently being edited", function () {
  assert.match(client, /const removingEditedProduct = productFields\.id\.value === product\.productId/);
  assert.match(client, /if \(removingEditedProduct\) resetProductForm\(\)/);
});
