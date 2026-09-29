const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover gallery arrows indicate first and last media boundaries", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 const section = source.slice(source.indexOf('function updateMediaPosition()'), source.indexOf('const choice = document.createElement("section")'));
 assert.match(section, /buttons\[0\]\.disabled = closest === 0/);
 assert.match(section, /buttons\[1\]\.disabled = closest === items\.length - 1/);
 assert.match(section, /mediaRegion\.addEventListener\("scroll", updateMediaPosition/);
 assert.match(section, /message\.appendChild\(controls\);\s*updateMediaPosition\(\)/);
 assert.match(section, /Math\.max\(0, Math\.min\(items\.length - 1, closest \+ control\[1\]\)\)/);
});
