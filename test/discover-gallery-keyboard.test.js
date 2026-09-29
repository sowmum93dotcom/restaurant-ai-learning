const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");

test("multi-media gallery is keyboard focusable and uses existing validated arrow controls", () => {
 assert.match(source, /if \(work\.media\.length > 1\) \{[\s\S]*?mediaRegion\.tabIndex = 0/);
 assert.match(source, /mediaRegion\.setAttribute\("aria-label", "Media from " \+ work\.businessName \+ "\. Use Left and Right arrow keys to browse; Home and End jump to the first and last media\."\)/);
 assert.match(source, /mediaRegion\.setAttribute\("aria-keyshortcuts", "ArrowLeft ArrowRight Home End"\)/);
 assert.match(source, /mediaRegion\.addEventListener\("keydown", function \(event\) \{/);
 assert.match(source, /event\.target !== mediaRegion/);
 assert.match(source, /event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey/);
 assert.match(source, /\["ArrowLeft", "ArrowRight", "Home", "End"\]\.includes\(event\.key\)/);
 assert.match(source, /event\.key === "Home" \|\| event\.key === "End"/);
 assert.match(source, /event\.key === "Home" \? items\[0\] : items\[items\.length - 1\]/);
 assert.match(source, /const offset = target\.getBoundingClientRect\(\)\.left - mediaRegion\.getBoundingClientRect\(\)\.left/);
 assert.match(source, /if \(Math\.abs\(offset\) > 1\) \{\s*pauseMediaVideos\(\)/);
 assert.match(source, /mediaRegion\.scrollBy\(\{ left: offset, behavior: reducedMotion \? "auto" : "smooth" \}\)/);
 assert.match(source, /event\.preventDefault\(\)/);
 assert.match(source, /if \(button && !button\.disabled\) button\.click\(\)/);
});
