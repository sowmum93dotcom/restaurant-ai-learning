const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");

test("optional location is explicit, bounded, session-only and clearable", () => {
  assert.match(source, /Number\.isFinite\(coords\.latitude\)/);
  assert.match(source, /Math\.abs\(coords\.longitude\) > 180/);
  assert.match(source, /let sessionLocation = null/);
  assert.match(source, /version !== locationRequestVersion/);
  assert.match(source, /\+\+locationRequestVersion;\s*sessionLocation = null/);
  assert.match(source, /Location-based recommendations are not enabled yet/);
  assert.match(html, /id="customer-location-clear"[^>]*hidden/);
  assert.doesNotMatch(source.slice(source.indexOf("async function requestCustomerPossibilities"), source.indexOf("function getLocalGreeting")), /sessionLocation/);
});
