const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover interest action stays compact and touch accessible on mobile and tablet", () => {
 const html = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 const css = fs.readFileSync(path.join(__dirname, "..", "css", "customer-mobile-refinement.css"), "utf8");
 assert.match(html, /intentionAction\.href = "#intention"/);
 const rule = css.slice(css.lastIndexOf("/* Touch-width Discover:"));
 assert.match(rule, /@media\(max-width:1180px\)/);
 assert.match(rule, /\.customer-participation\{/);
 assert.match(rule, /gap:10px;min-height:0/);
 assert.match(rule, /min-height:44px;margin:0/);
 assert.match(rule, /@media\(max-width:680px\)/);
});
