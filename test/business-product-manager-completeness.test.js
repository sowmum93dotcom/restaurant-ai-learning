const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "marketing.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "..", "js", "script.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "css", "style.css"), "utf8");

test("Business Product Manager shows owner the customer publication state", function () {
  assert.match(html, /business-products-total/);
  assert.match(html, /business-products-visible/);
  assert.match(html, /business-products-images/);
  assert.match(html, /visible products can appear only when genuinely relevant/);
  assert.match(js, /updateProductManagerSummary/);
  assert.match(js, /customerVisible !== false/);
});

test("Business Product Manager previews the exact business-provided image", function () {
  assert.match(html, /business-product-image-preview/);
  assert.match(js, /productImagePreviewImg\.src = imageUrl/);
  assert.match(js, /safeProductImageUrl\(imageUrl\)/);
  assert.match(html, /same business-provided image and approved continuation route/);
});

test("Business Product Manager additions are responsive", function () {
  assert.match(css, /business-products-manager-summary/);
  assert.match(css, /business-product-image-preview/);
  assert.match(css, /@media\(max-width:680px\)/);
});
