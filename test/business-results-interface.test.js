const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const { getBusinessResults, getRecommendationDecisions } = require("../js/business-results.js");
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

test("Business Results uses the authenticated Business Owner Workspace shell with a clear zero state", function () {
  assert.match(html, /<h1 class="restaurant-name">Business Owner Workspace<\/h1>/);
  assert.match(html, /id="owner-authenticated-workspace"[^>]* hidden/);
  assert.match(html, /class="is-active" href="business-results\.html" aria-current="page">Results<\/a>/);
  assert.doesNotMatch(html, /Back to Marketing Agent/);
  assert.match(html, /id="business-results-zero"[^>]* hidden/);
  assert.match(html, /No business results yet/);
  assert.deepEqual(getBusinessResults({ businessProfile: { businessId: "business-a" }, campaigns: [],
    customerParticipationResults: [] }, "business-a"), []);
});

test("Recommendation Decisions is separate from campaign evidence and has an empty state", function () {
  assert.match(html, /<h3 id="recommendation-decisions-heading">Recommendation Decisions<\/h3>/);
  assert.match(html, /Recorded choices you made about DEMEOS recommendations\. These are owner decisions, not campaign performance results\./);
  assert.match(html, /id="recommendation-decisions-empty"[^>]* hidden>No recommendation decisions recorded yet\./);
  assert.ok(html.indexOf("Campaign Outcomes") < html.indexOf("Recommendation Decisions"));
  assert.ok(html.indexOf("business-results-list") < html.indexOf("recommendation-decisions-list"));
  assert.deepEqual(getRecommendationDecisions({ businessProfile: { businessId: "business-a" } }, "business-a"), []);
});

test("valid server decisions use owner-facing labels, active-business isolation, and newest-first order", function () {
  const record = storedRecord();
  record.recommendationDecisions = [
    { businessId: "business-a", recommendationTitle: "Social welcome", suggestedCampaignType: "social", decision: "modified", timestamp: "2026-09-11T11:00:00.000Z" },
    { businessId: "business-a", recommendationTitle: "Full launch", suggestedCampaignType: "full", decision: "used", timestamp: "2026-09-10T10:00:00.000Z" },
    { businessId: "business-a", recommendationTitle: "Email update", suggestedCampaignType: "email", decision: "rejected", timestamp: "2026-09-12T12:00:00.000Z" },
    { businessId: "business-b", recommendationTitle: "Private choice", suggestedCampaignType: "email", decision: "used", timestamp: "2026-09-13T12:00:00.000Z" }
  ];
  assert.deepEqual(getRecommendationDecisions(record, "business-a"), [
    { recommendationTitle: "Email update", campaignType: "Email Campaign", ownerDecision: "Not for me", timestamp: "2026-09-12T12:00:00.000Z" },
    { recommendationTitle: "Social welcome", campaignType: "Social Media Campaign", ownerDecision: "Modified", timestamp: "2026-09-11T11:00:00.000Z" },
    { recommendationTitle: "Full launch", campaignType: "Full Marketing Campaign", ownerDecision: "Used", timestamp: "2026-09-10T10:00:00.000Z" }
  ]);
});

test("malformed recommendation decisions are ignored safely", function () {
  const valid = { businessId: "business-a", recommendationTitle: "Valid idea", suggestedCampaignType: "email", decision: "used", timestamp: "2026-09-12T12:00:00.000Z" };
  const malformed = [null, {},
    { ...valid, recommendationTitle: "   " }, { ...valid, suggestedCampaignType: "video" },
    { ...valid, decision: "successful" }, { ...valid, timestamp: "today" }, { ...valid, timestamp: null }];
  const record = { businessProfile: { businessId: "business-a" }, recommendationDecisions: [valid, ...malformed] };
  assert.deepEqual(getRecommendationDecisions(record, "business-a"), [{
    recommendationTitle: "Valid idea", campaignType: "Email Campaign", ownerDecision: "Used", timestamp: valid.timestamp
  }]);
});

class Element {
  constructor() { this.children = []; this.hidden = false; this._text = ""; }
  set textContent(value) { this._text = value; if (value === "") this.children = []; }
  get textContent() { return this._text; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
}

test("the page renders server-returned decisions and ignores browser decision storage", async function () {
  const elements = new Map();
  const document = { createElement() { return new Element(); }, getElementById(id) {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  } };
  const serverRecord = storedRecord();
  serverRecord.recommendationDecisions = [{ businessId: "business-a", recommendationTitle: "Trusted server idea",
    suggestedCampaignType: "email", decision: "rejected", timestamp: "2026-09-12T12:00:00.000Z" }];
  const reads = [];
  const context = { document, module: undefined, console, localStorage: { getItem(key) {
    reads.push(key);
    if (key === "demeosActiveBusinessId") return "business-a";
    if (key === "demeosRecommendationDecisions") return JSON.stringify([{ recommendationTitle: "Browser spoof" }]);
    return null;
  } }, fetch: async () => ({ ok: true, async json() { return serverRecord; } }) };
  vm.runInNewContext(script, context);
  await new Promise((resolve) => setImmediate(resolve));
  const cards = document.getElementById("recommendation-decisions-list").children;
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].children.map((child) => child.textContent), ["Trusted server idea", "Campaign type: Email Campaign",
    "Owner decision: Not for me", `Decision date: ${new Date("2026-09-12T12:00:00.000Z").toLocaleString()}`]);
  assert.deepEqual(reads, ["demeosActiveBusinessId"]);
  assert.equal(document.getElementById("recommendation-decisions-empty").hidden, true);
  assert.equal(document.getElementById("business-results-list").children.length, 1);
  assert.equal(document.getElementById("business-results-list").children[0].children[2].children.length, 2);
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

test("approved campaign with zero participation remains visible", function () {
  const record = storedRecord();
  record.campaigns.push({ id: "campaign-zero", businessId: "business-a", promoText: "Quiet campaign",
    campaignType: "email", approvalStatus: "Approved" });
  record.customerParticipationResults.push({ workItemId: "campaign-zero", businessId: "business-a",
    customerInterestCount: 0, latestParticipationAt: null });
  const zero = getBusinessResults(record, "business-a").find(function (result) {
    return result.campaignId === "campaign-zero";
  });
  assert.ok(zero);
  assert.equal(zero.customerInterestCount, 0);
  assert.equal(zero.latestParticipationAt, null);
  assert.equal(zero.outcome, null);
});

test("the interface contains no invented performance metrics", function () {
  const source = `${html}\n${script}`;
  assert.doesNotMatch(source, /\b(?:KPI|conversion rate|revenue|ROI|forecast|performance claim|customer identity|chart)\b/i);
});
