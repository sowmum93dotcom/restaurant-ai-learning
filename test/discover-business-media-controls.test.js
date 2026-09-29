const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover gallery controls identify the current business", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 assert.match(source, /controls\.setAttribute\("role", "group"\);\s*controls\.setAttribute\("aria-label", "Browse media from " \+ work\.businessName\)/);
 assert.match(source, /button\.setAttribute\("aria-label", control\[0\]\)/);
});
