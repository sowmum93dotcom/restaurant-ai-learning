const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover boundary arrows have a visible disabled style without hiding focus", () => {
 const css = fs.readFileSync(path.join(__dirname, "..", "css", "customer-mobile-refinement.css"), "utf8");
 assert.match(css, /\.customer-body #discover \.customer-media-control:disabled\s*\{[^}]*opacity:\.38;[^}]*cursor:default/);
 assert.match(css, /\.customer-body #discover \.customer-media-control:focus-visible/);
});
