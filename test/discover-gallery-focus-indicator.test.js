const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("focused Discover gallery has a visible keyboard focus indicator", () => {
 const css = fs.readFileSync(path.join(__dirname, "..", "css", "customer-mobile-refinement.css"), "utf8");
 assert.match(css, /\.customer-body #discover \.customer-work-media:focus-visible\s*\{[^}]*outline:3px solid #d4aa61;[^}]*outline-offset:-3px;[^}]*\}/);
});
