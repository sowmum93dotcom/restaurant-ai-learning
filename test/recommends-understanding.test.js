const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const { getDemeosUnderstanding } = require("../js/demeos-understanding.js");
const html = fs.readFileSync(require.resolve("../index.html"), "utf8");
const script = fs.readFileSync(require.resolve("../js/script.js"), "utf8");

function completeProfile(businessId) {
  return { businessId, name: "Alpha", type: "Cafe", location: "York", brandVoice: "Warm",
    targetCustomer: "Local families", goal: "Awareness" };
}

test("What DEMEOS Understands appears before the recommendation action with clear trust copy", function () {
  assert.match(html, /<h3 id="recommends-understanding-heading">What DEMEOS Understands<\/h3>/);
  assert.ok(html.indexOf("What DEMEOS Understands") < html.indexOf('id="recommendations-btn"'));
  assert.match(html, /Different evidence types remain separate so customer interest, owner feedback and owner decisions are not mistaken for verified business results\./);
  assert.match(html, /Interested signals show interest only, not a sale, conversion, revenue, booking or proof of success\./);
  assert.doesNotMatch(`${html}\n${script}`, /intelligence score|confidence percentage|maturity score|performance grade|success grade|ranking/i);
});

test("shared understanding counts only active-business server evidence and preserves evidence types", function () {
  const record = {
    businessProfile: completeProfile("a"),
    campaigns: [
      { id: "a-one", businessId: "a", outcome: { outcome: "Mixed" } },
      { id: "a-two", businessId: "a" },
      { id: "b-one", businessId: "b", outcome: { outcome: "Positive" } }
    ],
    customerParticipationResults: [
      { workItemId: "a-one", businessId: "a", customerInterestCount: 4 },
      { workItemId: "a-two", businessId: "a", customerInterestCount: 0 },
      { workItemId: "b-one", businessId: "b", customerInterestCount: 99 },
      { workItemId: "missing", businessId: "a", customerInterestCount: 8 }
    ],
    recommendationDecisions: [
      { businessId: "a", decision: "used" }, { businessId: "a", decision: "modified" },
      { businessId: "a", decision: "rejected" }, { businessId: "b", decision: "used" }
    ]
  };
  assert.deepEqual(getDemeosUnderstanding(record, "a"), {
    verifiedBusinessProfile: true,
    campaignOutcomeCount: 1,
    customerInterestCount: 4,
    campaignsWithCustomerParticipation: 2,
    recommendationDecisions: { used: 1, modified: 1, rejected: 1 },
    evidenceAvailable: true
  });
});

test("zero participation remains zero, missing participation is absent, and no identity or synthetic metric is returned", function () {
  const record = { businessProfile: completeProfile("a"), campaigns: [{ id: "zero", businessId: "a" }],
    customerParticipationResults: [{ workItemId: "zero", businessId: "a", customerInterestCount: 0 }] };
  const understanding = getDemeosUnderstanding(record, "a");
  assert.equal(understanding.customerInterestCount, 0);
  assert.equal(understanding.campaignsWithCustomerParticipation, 1);
  assert.deepEqual(getDemeosUnderstanding({ businessProfile: completeProfile("a"), campaigns: [] }, "a"), {
    verifiedBusinessProfile: true, campaignOutcomeCount: 0, customerInterestCount: 0,
    campaignsWithCustomerParticipation: 0,
    recommendationDecisions: { used: 0, modified: 0, rejected: 0 }, evidenceAvailable: false
  });
  assert.doesNotMatch(JSON.stringify(understanding), /customerName|email|identity|score|percent|rank|grade|success/i);
});

test("Recommends obtains understanding from the authenticated business record and keeps neutral unavailable values", function () {
  assert.match(script, /renderRecommendsUnderstanding\(result\.record, requestedBusinessId\)/);
  assert.match(script, /record: serverRecord/);
  assert.match(script, /Understanding evidence is unavailable/);
  assert.match(html, /id="recommends-understanding-interest">—<\/strong>/);
});
