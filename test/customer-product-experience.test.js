const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  availabilityCopy,
  priceCopy,
  safeHttps
} = require("../js/customer-product-experience.js");

test("Product Experience only accepts HTTPS continuation destinations", () => {
  assert.equal(safeHttps("https://example.com/buy"), "https://example.com/buy");
  assert.equal(safeHttps(" http://example.com/buy "), "");
  assert.equal(safeHttps("javascript:alert(1)"), "");
  assert.equal(safeHttps("//example.com/buy"), "");
  assert.equal(safeHttps(""), "");
  assert.equal(safeHttps(null), "");
});

test("Product Experience presents availability without inventing business claims", () => {
  assert.equal(availabilityCopy("unavailable"), "Currently unavailable");
  assert.equal(availabilityCopy("limited"), "Limited availability");
  assert.equal(availabilityCopy("contact"), "Contact business for availability");
  assert.equal(availabilityCopy("available"), "Available");
});

test("Product Experience preserves business-provided price presentation", () => {
  assert.equal(priceCopy({ price: "£22.00" }), "£22.00");
  assert.equal(priceCopy({ price: "£22.00", priceMode: "from" }), "From £22.00");
  assert.equal(priceCopy({ price: "£22–£30", priceMode: "range" }), "Price range: £22–£30");
  assert.equal(priceCopy({ price: "" }), "");
});

test("real Customer Experience loads the Product Experience surface, controller and styling", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  assert.match(html, /id="product-experience"/);
  assert.match(html, /id="product-experience-action"/);
  assert.match(html, /css\/customer-product-experience\.css/);
  assert.match(html, /js\/customer-product-experience\.js/);
});

test("Product Experience controller fails closed for unavailable products and unsafe destinations", () => {
  const controller = fs.readFileSync(path.join(__dirname, "..", "js", "customer-product-experience.js"), "utf8");
  assert.match(controller, /product\.availability !== "unavailable" && Boolean\(safeDestination\)/);
  assert.match(controller, /action\.rel = "noopener noreferrer"/);
  assert.match(controller, /event\.preventDefault\(\)/);
});
