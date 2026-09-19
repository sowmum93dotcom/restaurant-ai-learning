const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const customerHtml = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
const customerJs = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
const galleryCss = fs.readFileSync(path.join(__dirname, "..", "css", "customer-product-gallery.css"), "utf8");

test("Customer Interface explains when genuine business product images appear", function () {
  assert.match(customerHtml, /business-provided image/);
  assert.match(customerHtml, /DEMEOS does not invent product images/);
  assert.match(customerHtml, /customer-product-gallery\.css/);
});

test("possibility cards preview relevant product images before opening details", function () {
  assert.match(customerJs, /customer-possibility-product-preview/);
  assert.match(customerJs, /imageProducts\.slice\(0, 3\)/);
  assert.match(customerJs, /relevant product image/);
});

test("full product gallery remains visual and responsive", function () {
  assert.match(galleryCss, /\.customer-product-grid\{display:grid/);
  assert.match(galleryCss, /\.customer-product-card img/);
  assert.match(galleryCss, /object-fit:cover/);
  assert.match(galleryCss, /min-height:860px/);
  assert.match(galleryCss, /customer-product-detail-trust\\{color:#172435/);
});

test("customer normalization preserves dedicated visit address", function () {
  assert.match(customerJs, /visit: "visitAddress"/);
});
