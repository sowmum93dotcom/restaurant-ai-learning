const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync(require.resolve("../business-workspace.html"), "utf8");
const css = fs.readFileSync(require.resolve("../css/business-owner-signin-3d.css"), "utf8");

test("Business Owner page loads the dedicated 3D sign-in stylesheet", function () {
  assert.match(html, /css\/business-owner-signin-3d\.css/);
});

test("3D sign-in stylesheet uses the uploaded Business Owner artwork", function () {
  assert.match(css, /images\/54017379-F4D1-4881-A27E-E59CAFD4661C\.png/);
});

test("3D sign-in presentation is limited to the unauthenticated workspace state", function () {
  assert.match(css, /owner-workspace-body:has\(#owner-authenticated-workspace\[hidden\]\)/);
  assert.match(css, /owner-workspace-body:has\(#owner-authenticated-workspace\[hidden\]\) > \.owner-workspace-header/);
});

test("existing functional sign-in control remains present", function () {
  assert.match(html, /id="owner-sign-in"/);
  assert.match(html, /type="button">Sign in<\/button>/);
});
