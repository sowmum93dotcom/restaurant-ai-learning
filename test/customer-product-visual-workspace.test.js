const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const js = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "css", "customer-product-gallery.css"), "utf8");

test("customer gallery presents a counted accessible product workspace", function () {
  assert.match(js, /customer-product-gallery-header/);
  assert.match(js, /customer-products-count/);
  assert.match(js, /setAttribute\("role", "list"\)/);
  assert.match(js, /setAttribute\("role", "listitem"\)/);
});

test("customer gallery reserves a visual space without inventing images", function () {
  assert.match(js, /customer-product-image-frame/);
  assert.match(js, /customer-product-no-image/);
  assert.match(js, /has no business-provided image/);
  assert.match(js, /image\.decoding = "async"/);
});

test("customer gallery scales across wide and mobile interfaces", function () {
  assert.match(css, /auto-fill,minmax\(240px,1fr\)/);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(css, /min\(82vw,320px\)/);
});
