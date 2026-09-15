const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const customer = fs.readFileSync(path.join(root, "customer.html"), "utf8");
const relationship = fs.readFileSync(path.join(root, "my-demeos.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/demeos-customer-space.css"), "utf8");

test("both customer states share the scoped DEMEOS Space visual system", function () {
  assert.match(customer, /css\/demeos-customer-space\.css/);
  assert.match(relationship, /css\/demeos-customer-space\.css/);
  assert.match(css, /\.customer-body/);
  assert.match(css, /\.my-demeos-main/);
  assert.doesNotMatch(css, /\.owner-|\.workspace-/);
});

test("the official logo asset and only the official brand line remain", function () {
  for (const html of [customer, relationship]) {
    assert.match(html, /src="images\/demeos-logo\.png"/);
    assert.match(html, /ONE SYSTEM\. REAL VALUE\. SHARED FUTURE\./);
  }
});

test("intention nodes retain native semantics and spatial-to-linear responsive rules", function () {
  assert.match(customer, /<fieldset>[\s\S]*?<legend class="visually-hidden"/);
  assert.match(css, /\.customer-intention-option\s*\{[\s\S]*?position: absolute/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*?grid-template-columns: repeat\(2/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?grid-template-columns: 1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("the header remains in document flow and reserves usable content height", function () {
  assert.match(css, /\.customer-header\s*\{[\s\S]*?position: sticky/);
  assert.doesNotMatch(css, /\.customer-header\s*\{[^}]*position: fixed/);
  assert.match(css, /\.customer-intention\s*\{[^}]*min-height: calc\(100vh - 76px\)/);
});

test("relationship areas distinguish real controls from honest future sections", function () {
  assert.equal((relationship.match(/data-relationship-area=/g) || []).length, 3);
  assert.equal((relationship.match(/my-demeos-area-future/g) || []).length, 2);
  assert.match(css, /\.my-demeos-area-active/);
  assert.match(css, /\.my-demeos-area-future\s*\{[^}]*border-style: dashed/);
});

test("the visual layer introduces no commerce or ranking language", function () {
  assert.doesNotMatch(customer + relationship + css, /\b(?:ranking|ranked|sponsored|stars?|best deal|buy now|checkout)\b/i);
});
