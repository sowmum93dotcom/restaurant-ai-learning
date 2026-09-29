const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover media counter exposes an atomic polite status", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 const start = source.indexOf('const mediaPosition = addText(');
 assert.ok(start > -1);
 const section = source.slice(start, start + 650);
 assert.match(section, /mediaPosition\.setAttribute\("role", "status"\)/);
 assert.match(section, /mediaPosition\.setAttribute\("aria-live", "polite"\)/);
 assert.match(section, /mediaPosition\.setAttribute\("aria-atomic", "true"\)/);
});
