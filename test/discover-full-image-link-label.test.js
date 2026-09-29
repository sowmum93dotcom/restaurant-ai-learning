const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover full-image links distinguish gallery position and remain view-only", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 assert.match(source, /mediaLink\.setAttribute\("aria-label", "Open full image " \+ \(mediaIndex \+ 1\) \+ " of " \+ work\.media\.length \+ " from " \+ work\.businessName \+ " \\(opens in a new tab\\)"\)/);
 assert.match(source, /mediaLink\.href = asset\.deliveryUrl/);
 assert.match(source, /mediaLink\.rel = "noopener noreferrer"/);
});
