const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "businesses", "[businessId].js"), "utf8");

test("Business Profile captures a real offering and customer continuation without requiring a website", function () {
  assert.match(html, /What does your business provide\?/);
  assert.match(html, /A website is optional/);
  assert.match(html, /business-route-phone/);
  assert.match(html, /business-route-whatsapp/);
  assert.match(html, /business-route-visit/);
  assert.match(html, /business-route-website/);
});

test("Business Profile captures fulfilment separately from continuation", function () {
  assert.match(html, /How do customers receive your product or service\?/);
  assert.match(html, /business-fulfilment-collection/);
  assert.match(html, /business-fulfilment-delivery/);
  assert.match(html, /business-fulfilment-customer-location/);
  assert.match(script, /profileFields\.fulfilment = \{ methods: fulfilmentMethods/);
});

test("owner must confirm accuracy and server records business-provided provenance", function () {
  assert.match(html, /business-accuracy-confirmation/);
  assert.match(script, /Please confirm that the Business Profile information is accurate/);
  assert.match(api, /status: "business-provided"/);
  assert.match(api, /source: "business-owner"/);
  assert.match(api, /ownerConfirmedAt: new Date\(\)\.toISOString\(\)/);
});

test("server rejects unsupported continuation and fulfilment values", function () {
  assert.match(api, /ALLOWED_CONTINUATION_ROUTES/);
  assert.match(api, /ALLOWED_FULFILMENT_METHODS/);
  assert.match(api, /requiredRouteDetails/);
});
