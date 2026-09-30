const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "../css/customer-product-gallery.css"), "utf8");

test("mobile Product Experience uses full-width focused product presentation", () => {
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.customer-product-grid\{display:grid;grid-template-columns:1fr;overflow:visible;padding:0\}/);
  assert.match(css, /\.customer-product-card\{display:flex;flex-direction:column;width:100%;padding:\.7rem;scroll-snap-align:none\}/);
});

test("mobile Product Experience makes the product and Buy action visually primary", () => {
  assert.match(css, /\.customer-product-image-frame,\.customer-product-no-image\{order:1;width:100%;aspect-ratio:1\/1/);
  assert.match(css, /\.customer-product-price\{order:4[^}]*font-size:1\.45rem/);
  assert.match(css, /\.customer-product-continue-action\{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px[^}]*font-size:1\.05rem/);
});

test("mobile Product Experience removes carousel behaviour from the final presentation", () => {
  assert.match(css, /\.customer-product-grid\{display:grid;grid-template-columns:1fr;overflow:visible;padding:0\}/);
  assert.match(css, /\.customer-product-card\{display:flex;flex-direction:column;width:100%;padding:\.7rem;scroll-snap-align:none\}/);
});
