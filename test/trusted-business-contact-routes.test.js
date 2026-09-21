const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { toPublicCustomerWorkItem } = require("../api/_lib/customer-public-work-contract.js");

const html = fs.readFileSync(path.join(__dirname, "..", "marketing.html"), "utf8");
const api = fs.readFileSync(path.join(__dirname, "..", "api", "businesses", "[businessId].js"), "utf8");
const customer = fs.readFileSync(path.join(__dirname, "..", "js", "customer.js"), "utf8");

function work(continuation) {
  return { workItemId: "w1", businessId: "b1", businessName: "Example", content: "A genuine possibility",
    participationAction: "Interested", location: "Greater London service area", customerContinuation: continuation };
}

test("Business Profile separates visit address from general service area", function () {
  assert.match(html, /business-visit-address/);
  assert.match(html, /separate from your general location or service area/);
  assert.match(api, /routes\.includes\("visit"\).*visitAddress/);
});

test("public visit route requires an explicit business-provided visit address", function () {
  const missing = toPublicCustomerWorkItem(work({ routes: ["visit"] }));
  assert.equal(missing.customerContinuation, undefined);
  const valid = toPublicCustomerWorkItem(work({ routes: ["visit"], visitAddress: "10 Example Street, London" }));
  assert.deepEqual(valid.customerContinuation, { routes: ["visit"], visitAddress: "10 Example Street, London" });
});

test("customer map route uses visit address rather than broad business location", function () {
  assert.match(customer, /route === "visit" && detail/);
  assert.doesNotMatch(customer, /route === "visit" && possibility\.location/);
});

test("phone and WhatsApp routes receive basic international-friendly validation", function () {
  assert.match(api, /digits\.length >= 7 && digits\.length <= 15/);
  assert.match(api, /routes\.includes\("phone"\).*isPlausiblePhone/);
  assert.match(api, /routes\.includes\("whatsapp"\).*isPlausiblePhone/);
});
