const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const { getBusinessResults } = require("../js/business-results.js");
const html = fs.readFileSync(require.resolve("../business-results.html"), "utf8");
const script = fs.readFileSync(require.resolve("../js/business-results.js"), "utf8");

function storedRecord() {
  return {
    businessProfile: { businessId: "business-a", name: "Cafe A" },
    campaigns: [
      { id: "campaign-a", businessId: "business-a", promoText: "Friday supper",
        campaignTypeLabel: "Email Campaign", approvalStatus: "Approved",
        outcome: { outcome: "Positive", ownerNote: "More walk-ins." } },
      { id: "campaign-b", businessId: "business-b", promoText: "Other business",
        campaignTypeLabel: "Social Media Campaign", approvalStatus: "Approved",
        outcome: { outcome: "Mixed", ownerNote: "Must stay private." } }
    ],
    customerParticipationResults: [
      { workItemId: "campaign-a", businessId: "business-a", customerInterestCount: 3,
        latestParticipationAt: "2026-09-07T12:30:00.000Z" },
      { workItemId: "campaign-b", businessId: "business-b", customerInterestCount: 20,
        latestParticipationAt: "2026-09-08T12:30:00.000Z" }
    ]
  };
}

test("Business Results is a separate owner page with a clear zero state", function () {
  assert.match(html, /<h1 class="restaurant-name">Business Results<\/h1>/);
  assert.match(html, /href="index\.html">Back to Marketing Agent<\/a>/);
  assert.match(html, /id="business-results-zero"[^>]* hidden/);
  assert.match(html, /No business results yet/);
  assert.deepEqual(getBusinessResults({ businessProfile: { businessId: "business-a" }, campaigns: [],
    customerParticipationResults: [] }, "business-a"), []);
});

test("results are isolated to the active business", function () {
  const results = getBusinessResults(storedRecord(), "business-a");
  assert.equal(results.length, 1);
  assert.equal(results[0].campaignId, "campaign-a");
  assert.doesNotMatch(JSON.stringify(results), /Other business|Must stay private|"customerInterestCount":20/);
  assert.deepEqual(getBusinessResults(storedRecord(), "business-b"), []);
});

test("only stored outcomes and participation values are exposed", function () {
  assert.deepEqual(getBusinessResults(storedRecord(), "business-a"), [{
    campaignId: "campaign-a", name: "Friday supper", type: "Email Campaign", status: "Approved",
    outcome: "Positive", ownerNote: "More walk-ins.", customerInterestCount: 3,
    latestParticipationAt: "2026-09-07T12:30:00.000Z"
  }]);
});

test("approved participation stays associated with its campaign", function () {
  const record = storedRecord();
  record.campaigns.push({ id: "campaign-c", businessId: "business-a", promoText: "Lunch",
    campaignType: "social", approvalStatus: "Approved" });
  record.customerParticipationResults.push({ workItemId: "campaign-c", businessId: "business-a",
    customerInterestCount: 1, latestParticipationAt: null });
  const results = getBusinessResults(record, "business-a");
  assert.equal(results.find(function (result) { return result.campaignId === "campaign-a"; }).customerInterestCount, 3);
  assert.equal(results.find(function (result) { return result.campaignId === "campaign-c"; }).customerInterestCount, 1);
});

test("the interface contains no invented performance metrics", function () {
  const source = `${html}\n${script}`;
  assert.doesNotMatch(source, /\b(?:KPI|conversion rate|revenue|ROI|forecast|performance claim|customer identity|chart)\b/i);
});
