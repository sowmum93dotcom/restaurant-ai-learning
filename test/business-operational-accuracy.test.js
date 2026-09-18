const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { toPublicCustomerWorkItem } = require("../api/_lib/customer-public-work-contract.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "businesses", "[businessId].js"), "utf8");

test("Business Profile lets the owner state current availability without DEMEOS inventing it", function () {
  assert.match(html, /Current customer availability/);
  assert.match(html, /Available for new customer enquiries/);
  assert.match(html, /Not currently available for new enquiries/);
  assert.match(html, /business-provided operational information, not a DEMEOS guarantee/);
  assert.match(script, /profileFields\.operationalAvailability/);
});

test("enhanced Business Profile validates safe customer destinations and actionable quote routes", function () {
  assert.match(api, /isSafeHttpUrl/);
  assert.match(api, /isPlausibleEmail/);
  assert.match(api, /continuation\.routes\.includes\("quote"\)/);
  assert.match(script, /Request quote \/ enquiry needs at least one contact route/);
});

test("public customer work carries only recognized current availability", function () {
  const item = toPublicCustomerWorkItem({
    workItemId: "work-availability", businessName: "Example", content: "Customer-facing work",
    operationalAvailability: { status: "limited", hoursNotes: "Mon-Fri", notes: "Contact us first" }
  });
  assert.deepEqual(item.operationalAvailability, { status: "limited", hoursNotes: "Mon-Fri", notes: "Contact us first" });
  const invalid = toPublicCustomerWorkItem({
    workItemId: "work-invalid", businessName: "Example", content: "Customer-facing work",
    operationalAvailability: { status: "guaranteed" }
  });
  assert.equal(invalid.operationalAvailability, undefined);
});
