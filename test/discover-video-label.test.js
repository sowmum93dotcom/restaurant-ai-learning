const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover business videos have a contextual accessible label", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 assert.match(source, /if \(asset\.kind === "video"\) \{\s*media\.setAttribute\("aria-label", "Video " \+ \(mediaIndex \+ 1\) \+ " of " \+ work\.media\.length \+ " from " \+ work\.businessName\)/);
 assert.match(source, /media\.controls = true; media\.preload = "metadata"; media\.playsInline = true/);
});
