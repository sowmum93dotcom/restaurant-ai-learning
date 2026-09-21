const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const { getDemeosUnderstanding } = require("../js/demeos-understanding.js");
const html = fs.readFileSync(require.resolve("../marketing.html"), "utf8");
const script = fs.readFileSync(require.resolve("../js/script.js"), "utf8");

const profile = { businessId: "business-a", name: "A", type: "Cafe", location: "York",
  brandVoice: "Warm", targetCustomer: "Neighbours", goal: "Awareness" };

test("Understanding links an owner decision, subsequently created work, and owner-recorded outcome", function () {
  const understanding = getDemeosUnderstanding({ businessProfile: profile,
    recommendationDecisions: [{ decisionId: "decision-1", businessId: "business-a",
      recommendationTitle: "A neighbourhood update", suggestedCampaignType: "email", decision: "used",
      timestamp: "2026-08-01T10:00:00.000Z" }],
    campaigns: [{ id: "work-1", businessId: "business-a", recommendationDecisionId: "decision-1",
      createdAt: "2026-08-02T10:00:00.000Z", outcome: { outcome: "Mixed",
        savedAt: "2026-08-09T10:00:00.000Z" } }] }, "business-a");

  assert.deepEqual(understanding.trustedLearningHistory, [{
    recommendation: "A neighbourhood update",
    decision: { value: "used", recordedAt: "2026-08-01T10:00:00.000Z", source: "business-owner" },
    relatedWork: { created: true, workItemId: "work-1", recordedAt: "2026-08-02T10:00:00.000Z",
      source: "demeos-campaign-record" },
    outcome: { value: "Mixed", recordedAt: "2026-08-09T10:00:00.000Z", source: "business-owner" }
  }]);
  assert.match(script, /Later owner-recorded outcome/);
  assert.match(script, /This is historical evidence, not current demand/);
  assert.match(html, /What DEMEOS learned from earlier owner decisions/);
});

test("decision meaning remains separate from outcome and a missing outcome is explicit absence", function () {
  const understanding = getDemeosUnderstanding({ businessProfile: profile,
    recommendationDecisions: [
      { decisionId: "used", businessId: "business-a", recommendationTitle: "Used idea", decision: "used",
        timestamp: "2026-08-01T10:00:00.000Z" },
      { decisionId: "rejected", businessId: "business-a", recommendationTitle: "Rejected idea", decision: "rejected",
        timestamp: "2026-08-03T10:00:00.000Z" }
    ], campaigns: [{ id: "draft", businessId: "business-a", recommendationDecisionId: "used",
      createdAt: "2026-08-02T10:00:00.000Z" }] }, "business-a");

  assert.equal(understanding.trustedLearningHistory[0].decision.value, "used");
  assert.equal(understanding.trustedLearningHistory[0].outcome, null);
  assert.equal(understanding.trustedLearningHistory[1].decision.value, "rejected");
  assert.equal(understanding.trustedLearningHistory[1].relatedWork.created, false);
  assert.doesNotMatch(JSON.stringify(understanding.trustedLearningHistory), /success|failure|current demand/i);
  assert.match(script, /There is no owner-recorded outcome for this previous decision; absence is not failure/);
});

test("another business cannot supply linked work or an outcome", function () {
  const understanding = getDemeosUnderstanding({ businessProfile: profile,
    recommendationDecisions: [
      { decisionId: "shared", businessId: "business-a", recommendationTitle: "A idea", decision: "modified",
        timestamp: "2026-08-01T10:00:00.000Z" },
      { decisionId: "other", businessId: "business-b", recommendationTitle: "B idea", decision: "used",
        timestamp: "2026-08-01T10:00:00.000Z" }
    ], campaigns: [{ id: "work-b", businessId: "business-b", recommendationDecisionId: "shared",
      createdAt: "2026-08-02T10:00:00.000Z", outcome: { outcome: "Positive",
        savedAt: "2026-08-09T10:00:00.000Z" } }] }, "business-a");

  assert.equal(understanding.trustedLearningHistory.length, 1);
  assert.equal(understanding.trustedLearningHistory[0].recommendation, "A idea");
  assert.equal(understanding.trustedLearningHistory[0].relatedWork.created, false);
  assert.equal(understanding.trustedLearningHistory[0].outcome, null);
});

test("trusted history links customer evidence to work without promoting it to current evidence", function () {
  const understanding = getDemeosUnderstanding({
    businessProfile: profile,
    recommendationDecisions: [{ decisionId: "decision-2", businessId: "business-a",
      recommendationTitle: "Invite nearby families", suggestedCampaignType: "social", decision: "modified",
      timestamp: "2026-08-01T10:00:00.000Z" }],
    campaigns: [{ id: "work-2", businessId: "business-a", recommendationDecisionId: "decision-2",
      approvalStatus: "Approved", createdAt: "2026-08-02T10:00:00.000Z" }],
    customerParticipationResults: [{ workItemId: "work-2", businessId: "business-a", customerInterestCount: 4,
      latestParticipationAt: "2026-08-03T10:00:00.000Z" }],
    customerFeedbackResults: [{ workItemId: "work-2", businessId: "business-a", relevantCount: 2,
      notQuiteCount: 1, somethingDifferentCount: 0, latestFeedbackAt: "2026-08-04T10:00:00.000Z" }]
  }, "business-a");
  const [history] = understanding.trustedLearningHistory;
  assert.deepEqual(history.customerParticipation, { interestedCount: 4,
    recordedAt: "2026-08-03T10:00:00.000Z", source: "customer-interested-action" });
  assert.deepEqual(history.customerFeedback, { relevant: 2, notQuite: 1, somethingDifferent: 0,
    recordedAt: "2026-08-04T10:00:00.000Z", source: "customer-feedback-action" });
  assert.deepEqual(understanding.evidenceContext.current, [{ evidenceType: "business-profile", source: "business-owner" }]);
  assert.ok(understanding.evidenceContext.historical.some((item) => item.evidenceType === "customer-participation"));
  assert.ok(understanding.evidenceContext.historical.some((item) => item.evidenceType === "customer-feedback"));
});
