const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover media arrows form a labelled navigation group", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 assert.match(source, /controls\.className = "customer-media-controls";\s*controls\.setAttribute\("role", "group"\);\s*controls\.setAttribute\("aria-label", "Browse media from " \+ work\.businessName\)/);
 assert.match(source, /\["Previous image or video", -1, "←"\], \["Next image or video", 1, "→"\]/);
});
