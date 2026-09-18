const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "js", "script.js"), "utf8");
const api = fs.readFileSync(path.join(__dirname, "..", "api", "businesses", "[businessId].js"), "utf8");
const publicWork = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "customer-public-work-contract.js"), "utf8");
const customer = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");

test("Business Product Manager supports explicit price semantics", function () {
  assert.match(html, /business-product-price-mode/);
  assert.match(html, /Contact for price/);
  assert.match(html, /Fixed price/);
  assert.match(html, /From price/);
  assert.match(html, /Price range/);
  assert.match(client, /priceMode/);
  assert.match(api, /\["contact", "fixed", "from", "range"\]/);
});

test("contact-for-price cannot silently carry a numeric-looking owner price", function () {
  assert.match(api, /priceMode === "contact" && price/);
  assert.match(api, /priceMode !== "contact" && !price/);
});

test("owners can inherit business fulfilment or explicitly override it per product", function () {
  assert.match(html, /Use business fulfilment/);
  assert.match(html, /Choose for this product/);
  assert.match(client, /selectedProductFulfilment/);
  assert.match(api, /productFulfilment\.methods\.some/);
});

test("public product contract minimizes and validates fulfilment methods", function () {
  assert.match(publicWork, /product\.fulfilment && Array\.isArray\(product\.fulfilment\.methods\)/);
  assert.match(publicWork, /ALLOWED_FULFILMENT_METHODS\.has\(method\)/);
});

test("Customer Interface explains price mode and product-specific fulfilment", function () {
  assert.match(customer, /Contact business for price/);
  assert.match(customer, /"From " \+ product\.price/);
  assert.match(customer, /"Price range: " \+ product\.price/);
  assert.match(customer, /How you receive it:/);
});
