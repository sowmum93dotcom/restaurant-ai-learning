const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover approved images identify their business and media position", () => {
 const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 assert.match(source, /media\.alt = `Approved image \$\{mediaIndex \+ 1\} of \$\{work\.media\.length\} from \$\{work\.businessName\}`/);
 assert.match(source, /media\.loading = anchorJourney && mediaIndex === 0 \? "eager" : "lazy"/);
});
