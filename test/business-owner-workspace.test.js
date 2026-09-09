const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const { getOwnerWorkspaceContext } = require("../js/business-workspace.js");
const html = fs.readFileSync(require.resolve("../business-workspace.html"), "utf8");
const script = fs.readFileSync(require.resolve("../js/business-workspace.js"), "utf8");

function storage(values) {
  return { getItem: function (key) { return Object.hasOwn(values, key) ? values[key] : null; } };
}

test("workspace contains exactly the five owner-facing sections", function () {
  const labels = Array.from(html.matchAll(/<a[^>]*>([^<]+)<\/a>/g), function (match) { return match[1]; });
  assert.deepEqual(labels, ["Overview", "Business Profile", "DEMEOS Recommends", "Marketing", "Results", "Manage Business Profile", "Open Marketing Agent"]);
  assert.match(html, /aria-label="Business Owner Workspace"/);
});

test("owner navigation reuses existing owner functionality", function () {
  assert.match(html, /href="index\.html#business-profile">Business Profile<\/a>/);
  assert.match(html, /href="index\.html#recommends">DEMEOS Recommends<\/a>/);
  assert.match(html, /href="index\.html">Marketing<\/a>/);
  assert.match(html, /href="business-results\.html">Results<\/a>/);
  assert.doesNotMatch(html, /iframe|data-workspace-view|id="recommendations-btn"|id="generate-btn"/);
});

test("workspace isolates overview data to the selected business", function () {
  const context = getOwnerWorkspaceContext(storage({
    demeosActiveBusinessId: "business-a",
    demeosBusinessProfiles: JSON.stringify([
      { businessId: "business-a", name: "Cafe A", type: "Cafe", location: "Leeds" },
      { businessId: "business-b", name: "Private Rival" }
    ]),
    demeosCampaignHistory: JSON.stringify([
      { businessId: "business-a", promoText: "Autumn menu", approvalStatus: "Approved" },
      { businessId: "business-b", promoText: "Rival plans", approvalStatus: "Draft" }
    ])
  }));
  assert.equal(context.profile.name, "Cafe A");
  assert.deepEqual(context.currentWork, [{ name: "Autumn menu", status: "Approved" }]);
  assert.doesNotMatch(JSON.stringify(context), /Private Rival|Rival plans/);
});

test("workspace exposes no admin controls, invented metrics, or unsupported capabilities", function () {
  const source = `${html}\n${script}`;
  assert.doesNotMatch(source, /DEMEOS Admin|admin control|customer identity|booking|ordering|CRM|loyalty|payments/i);
  assert.doesNotMatch(source, /revenue|ROI|conversion rate|forecast|analytics|recommendationTitle|demeosCapability/i);
  assert.doesNotMatch(source, /Add Business|business-selector|fetch\s*\(|\/api\//);
});
