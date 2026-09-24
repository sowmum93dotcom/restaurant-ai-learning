const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync(require.resolve("../business-workspace.html"), "utf8");
const css = fs.readFileSync(require.resolve("../css/business-owner-signin-3d.css"), "utf8");

test("Business Owner page loads the dedicated sign-in presentation stylesheet", function () {
  assert.match(html, /css\/business-owner-signin-3d\.css/);
});

test("Business Owner sign-in no longer uses the legacy promotional artwork", function () {
  assert.doesNotMatch(css, /54017379-F4D1-4881-A27E-E59CAFD4661C\.png/);
  assert.match(css, /background:#020b18/);
});

test("simple sign-in presentation is limited to the unauthenticated workspace state", function () {
  assert.match(css, /owner-workspace-body:has\(#owner-authenticated-workspace\[hidden\]\)/);
  assert.match(css, /owner-workspace-body:has\(#owner-authenticated-workspace\[hidden\]\)>\.owner-workspace-header/);
});

test("existing functional sign-in control remains present", function () {
  assert.match(html, /id="owner-sign-in"/);
  assert.match(html, /type="button">Continue with Google<\/button>/);
});
