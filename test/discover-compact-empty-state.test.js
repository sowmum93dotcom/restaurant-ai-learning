const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Discover empty approved feed is compact and remains clearly distinct from test content", () => {
 const js = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
 const css = fs.readFileSync(path.join(__dirname, "..", "css", "customer-mobile-refinement.css"), "utf8");
 assert.match(js, /status\.className = "customer-empty-state"/);
 assert.match(js, /Nothing to discover just yet/);
 assert.match(js, /CONTROLLED TEST CONTENT — not live business content/);
 const rule = css.slice(css.lastIndexOf("/* An empty approved feed"));
 assert.match(rule, /\.customer-discover-meta \.customer-empty-state/);
 assert.match(rule, /min-height:0;width:100%/);
 assert.match(rule, /background:#132b46/);
 assert.match(rule, /text-align:start/);
});
