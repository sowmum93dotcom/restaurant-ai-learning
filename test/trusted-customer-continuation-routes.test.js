const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { toPublicCustomerWorkItem } = require("../api/_lib/customer-public-work-contract.js");

function work(continuation) {
  return { workItemId: "work-1", businessId: "business-1", businessName: "Example Business",
    content: "A genuine customer possibility", participationAction: "Interested", customerContinuation: continuation };
}

test("visit route publishes the dedicated business-approved visit address", function () {
  const item = toPublicCustomerWorkItem(work({ routes: ["visit"], visitAddress: "10 High Street, London" }));
  assert.deepEqual(item.customerContinuation, { routes: ["visit"], visitAddress: "10 High Street, London" });
});

test("visit route is removed when no dedicated visit address exists", function () {
  const item = toPublicCustomerWorkItem(work({ routes: ["visit"] }));
  assert.equal(item.customerContinuation, undefined);
});

test("general business location is not substituted for a visit address", function () {
  const item = work({ routes: ["visit"] }); item.location = "South London service area";
  const published = toPublicCustomerWorkItem(item);
  assert.equal(published.customerContinuation, undefined);
});

test("international-friendly phone formats are accepted but malformed contact routes are not published", function () {
  const accepted = toPublicCustomerWorkItem(work({ routes: ["phone", "whatsapp"], phone: "+44 20 7946 0958", whatsapp: "+1 (212) 555-0100" }));
  assert.deepEqual(accepted.customerContinuation.routes, ["phone", "whatsapp"]);
  const rejected = toPublicCustomerWorkItem(work({ routes: ["phone", "whatsapp"], phone: "call-me", whatsapp: "123" }));
  assert.equal(rejected.customerContinuation, undefined);
});

test("Customer Interface maps visits from visitAddress, never the general possibility location", function () {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");
  assert.match(source, /visit: "visitAddress"/);
  assert.doesNotMatch(source, /route === "visit" && possibility\.location/);
  assert.match(source, /route === "visit" && detail/);
});

test("Business Profile makes visit address a route-specific control", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "marketing.html"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "..", "js", "script.js"), "utf8");
  assert.match(html, /Customer visit address/);
  assert.match(html, /separate from your general location or service area/);
  assert.match(script, /visit: byId\("business-visit-address"\)\.parentElement/);
});
