const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("narrow Discover product cards preserve square media and a full-width action", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "css", "customer-mobile-refinement.css"), "utf8");
  const narrow = css.slice(css.lastIndexOf("/* Narrow phones:"));
  assert.match(narrow, /@media\(max-width:380px\)/);
  assert.match(narrow, /grid-template-columns:80px minmax\(0,1fr\)/);
  assert.match(narrow, /aspect-ratio:1 \/ 1/);
  assert.match(narrow, /grid-column:1 \/ -1;grid-row:auto;width:100%;min-height:44px/);
  assert.match(narrow, /\.has-image/);
});
