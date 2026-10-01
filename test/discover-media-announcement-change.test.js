const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover live media counter updates only when position changes", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 const start = source.indexOf('function updateMediaPosition()');
 assert.ok(start > -1);
 const section = source.slice(start, source.indexOf('mediaRegion.addEventListener("scroll", updateMediaPosition', start));
 assert.match(section, /if \(mediaPosition\.textContent !== positionLabel\) \{/);
 assert.match(section, /mediaPosition\.textContent = positionLabel/);
 assert.match(section, /mediaPosition\.setAttribute\("aria-label", positionLabel\)/);
 assert.match(source, /mediaPosition\.setAttribute\("aria-live", "polite"\)/);
});
