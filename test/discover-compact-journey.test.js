const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover mobile journey stays a compact readable three-step orientation", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "css", "customer-mobile-refinement.css"), "utf8");
  const guide = html.match(/<div class="customer-discover-entry-guide"[\s\S]*?<div id="customer-work-list"/)?.[0];
  assert.ok(guide);
  for (const step of ["Discover", "Tell DEMEOS", "My DEMEOS"]) assert.ok(guide.includes(step));
  const compact = css.slice(css.lastIndexOf("/* Keep the three-step orientation"));
  assert.match(compact, /@media\(max-width:680px\)/);
  assert.match(compact, /grid-template-columns:minmax\(0,1fr\)/);
  assert.match(compact, /border-top:1px solid/);
  assert.match(compact, /span:last-child\{grid-column:2/);
});
