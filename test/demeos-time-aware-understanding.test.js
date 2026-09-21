const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const { getDemeosUnderstanding } = require("../js/demeos-understanding.js");
const databaseSource = fs.readFileSync(require.resolve("../api/_lib/database.js"), "utf8");
const recommendSource = fs.readFileSync(require.resolve("../api/recommend.js"), "utf8");
const html = fs.readFileSync(require.resolve("../marketing.html"), "utf8");
const script = fs.readFileSync(require.resolve("../js/script.js"), "utf8");

const profile = { businessId: "business-a", name: "A", type: "Cafe", location: "York",
  brandVoice: "Warm", targetCustomer: "Neighbours", goal: "Awareness" };

test("Understanding preserves each authoritative evidence time and provenance without merging meanings", function () {
  const understanding = getDemeosUnderstanding({ businessProfile: profile, campaigns: [{
    id: "work-a", businessId: "business-a", approvalStatus: "Approved",
    approvedAt: "2024-01-01T09:00:00.000Z",
    outcome: { outcome: "Mixed", savedAt: "2024-02-01T09:00:00.000Z" }
  }], customerParticipationResults: [{ workItemId: "work-a", businessId: "business-a",
    customerInterestCount: 2, latestParticipationAt: "2024-01-10T09:00:00.000Z",
    evidenceType: "customer-participation", source: "customer-interested-action" }],
  customerFeedbackResults: [{ workItemId: "work-a", businessId: "business-a", relevantCount: 1,
    notQuiteCount: 0, somethingDifferentCount: 0, latestFeedbackAt: "2024-01-11T09:00:00.000Z",
    evidenceType: "customer-feedback", source: "customer-feedback-action" }],
  recommendationDecisions: [{ businessId: "business-a", decision: "used",
    timestamp: "2024-01-12T09:00:00.000Z" }] }, "business-a");

  assert.deepEqual(understanding.evidenceContext.current,
    [{ evidenceType: "business-profile", source: "business-owner" }]);
  assert.deepEqual(understanding.evidenceContext.historical, [
    { recordedAt: "2024-01-01T09:00:00.000Z", source: "business-owner-approval", evidenceType: "approved-work" },
    { recordedAt: "2024-02-01T09:00:00.000Z", source: "business-owner", evidenceType: "owner-recorded-outcome" },
    { recordedAt: "2024-01-10T09:00:00.000Z", source: "customer-interested-action", evidenceType: "customer-participation" },
    { recordedAt: "2024-01-11T09:00:00.000Z", source: "customer-feedback-action", evidenceType: "customer-feedback" },
    { recordedAt: "2024-01-12T09:00:00.000Z", source: "business-owner", evidenceType: "recommendation-decision" }
  ]);
  assert.deepEqual(understanding.evidenceContext.absent, []);
  assert.equal(understanding.customerInterestCount, 2);
  assert.equal(understanding.customerFeedback.relevant, 1);
  assert.equal(understanding.campaignOutcomeCount, 1);
});

test("old interest and feedback stay historical while missing recent evidence is absence, not failure", function () {
  const understanding = getDemeosUnderstanding({ businessProfile: profile, campaigns: [
    { id: "old", businessId: "business-a", approvalStatus: "Approved" }
  ], customerParticipationResults: [{ workItemId: "old", businessId: "business-a", customerInterestCount: 1,
    latestParticipationAt: "2001-01-01T00:00:00.000Z" }], customerFeedbackResults: [] }, "business-a");
  assert.equal(understanding.evidenceContext.historical[0].evidenceType, "customer-participation");
  assert.equal(understanding.evidenceContext.historical[0].recordedAt, "2001-01-01T00:00:00.000Z");
  assert.ok(understanding.evidenceContext.absent.includes("customer-feedback"));
  assert.ok(understanding.evidenceContext.absent.includes("owner-recorded-outcome"));
  assert.doesNotMatch(JSON.stringify(understanding.evidenceContext), /demand|sale|booking|conversion|success|preference|failure/i);
});

test("authoritative schema and recommendation boundaries preserve time without decay or semantic promotion", function () {
  assert.match(databaseSource, /approved_at TIMESTAMPTZ NULL/);
  assert.match(databaseSource, /participated_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  assert.match(databaseSource, /created_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  assert.match(databaseSource, /decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  assert.match(recommendSource, /historical-evidence-present-claim/);
  assert.match(recommendSource, /Describe it only as interest recorded previously at its recorded time/);
  assert.match(recommendSource, /Describe feedback only as feedback recorded previously at its recorded time/);
  assert.doesNotMatch(recommendSource, /decay score|confidence percentage|expiry period|ranking weight/i);
  assert.match(html, /Historical customer participation evidence/);
  assert.match(script, /absence is not failure/);
});
