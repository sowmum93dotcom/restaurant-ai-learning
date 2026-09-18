const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");

test("Business Profile presents the owner journey in five simple progressive steps", function () {
  for (const heading of ["Your business", "Products &amp; services", "How customers continue", "Current operations", "Review &amp; save"]) {
    assert.match(html, new RegExp(heading.replace("&", "&amp;").replace("&amp;amp;", "&amp;")));
  }
  assert.match(html, /business-profile-progress/);
  assert.match(html, /Customers only see information that is safe to use for their need/);
});

test("customer route details stay hidden until their route is selected", function () {
  for (const route of ["website", "phone", "whatsapp", "email", "booking"]) {
    assert.match(html, new RegExp('data-route-detail="' + route + '" hidden'));
  }
  assert.match(script, /updateContinuationDetailVisibility/);
  assert.match(script, /checkbox\.addEventListener\("change", updateContinuationDetailVisibility\)/);
  assert.match(css, /profile-route-details \[hidden\]/);
});

test("progressive layout includes a mobile treatment without changing trust semantics", function () {
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(html, /business-provided information/);
  assert.match(html, /not presented as independently verified unless DEMEOS has separately verified it/);
});
