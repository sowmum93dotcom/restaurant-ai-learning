const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover gallery position politely announces media changes", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 const section = source.slice(source.indexOf('const mediaPosition = addText('), source.indexOf('const mediaPosition = addText(') + 1800);
 assert.match(section, /mediaPosition\.setAttribute\("aria-live", "polite"\)/);
 assert.match(section, /mediaPosition\.setAttribute\("aria-atomic", "true"\)/);
 assert.match(section, /mediaPosition\.textContent = "Media " \+ \(closest \+ 1\)/);
});
