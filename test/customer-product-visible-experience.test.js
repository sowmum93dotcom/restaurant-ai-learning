const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "../css/customer-product-gallery.css"), "utf8");

test("mobile Product Experience uses full-width focused product presentation", () => {
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.customer-product-grid\{display:grid;overflow:visible;padding:0\}/);
  assert.match(css, /\.customer-product-card\{display:flex;flex-direction:column;width:100%/);
  assert.doesNotMatch(css, /scroll-snap-type:x mandatory/);
  assert.doesNotMatch(css, /flex:0 0 min\(82vw,320px\)/);
});

test("mobile Product Experience makes the product and Buy action visually primary", () => {
  assert.match(css, /\.customer-product-image-frame,\.customer-product-no-image\{order:1;width:100%;aspect-ratio:1\/1/);
  assert.match(css, /\.customer-product-price\{order:4[^}]*font-size:1\.45rem/);
  assert.match(css, /\.customer-product-continue-action\{min-height:52px;font-size:1\.05rem\}/);
});

test("desktop Product Experience keeps one focused product column", () => {
  assert.match(css, /\.customer-product-grid\{display:grid;grid-template-columns:1fr/);
  assert.match(css, /\.customer-product-card\{display:grid;grid-template-columns:minmax\(0,1\.08fr\) minmax\(260px,\.92fr\)/);
});
