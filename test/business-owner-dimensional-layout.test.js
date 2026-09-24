const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css/demeos-business-premium.css"), "utf8");
const overview = fs.readFileSync(path.join(root, "business-workspace.html"), "utf8");
const profile = fs.readFileSync(path.join(root, "marketing.html"), "utf8");

test("dimensional Overview styles are scoped to the authenticated workspace", () => {
  assert.match(css, /\.owner-workspace-body:has\(#owner-authenticated-workspace:not\(\[hidden\]\)\)/);
  assert.match(overview, /id="owner-authenticated-workspace"[^>]*hidden/);
  for (const id of ["workspace-business-identity", "workspace-next-action", "workspace-current-work"]) {
    assert.match(overview, new RegExp('id="' + id + '"'));
  }
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:760px\)/);
});

test("Business Profile design retains the six real step anchors and responsive navigation", () => {
  for (const id of ["business-profile-identity", "business-profile-offering",
    "business-profile-continuation", "business-profile-operations",
    "business-profile-marketing", "business-profile-confirmation"]) {
    assert.match(profile, new RegExp('id="' + id + '"'));
    assert.match(profile, new RegExp('href="#' + id + '"'));
  }
  assert.match(css, /#business-profile \.business-profile-progress/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("route visibility and form controls remain available in the visual layout", () => {
  assert.match(css, /#business-profile \.profile-route-details>\[hidden\]\{display:none\}/);
  assert.match(profile, /id="business-product-add-btn"/);
  assert.match(profile, /id="business-media-upload-btn"/);
  assert.match(profile, /id="business-selector"/);
  assert.doesNotMatch(css, /#business-profile\s*\{\s*display:none/);
});

test("new visual stylesheet retains balanced CSS blocks", () => {
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
});
