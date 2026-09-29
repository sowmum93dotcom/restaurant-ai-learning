const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover arrow paging respects reduced-motion preference", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 const start = source.indexOf('button.addEventListener("click", function () {', source.indexOf('controls.className = "customer-media-controls"'));
 assert.ok(start > -1);
 const section = source.slice(start, start + 1300);
 assert.match(section, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
 assert.match(section, /behavior: reducedMotion \? "auto" : "smooth"/);
 assert.match(section, /typeof window\.matchMedia === "function"/);
});
