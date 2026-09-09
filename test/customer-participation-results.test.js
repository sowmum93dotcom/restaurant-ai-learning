const assert = require("node:assert/strict");
const test = require("node:test");

const { createPersistenceRepository } = require("../api/_lib/persistence.js");
const { getCustomerParticipationResults } = require("../js/script.js");

function resultsRepository(rows) {
  return createPersistenceRepository({
    async ensureSchema() {},
    async query(sql, values) {
      if (sql.startsWith("SELECT profile")) return { rows: [{ profile: { name: "Cafe" } }] };
      if (sql.includes("demeos_recommendation_decisions")) return { rows: [] };
      assert.deepEqual(values, ["business-a"]);
      return { rows };
    }
  });
}

test("participation results remain isolated to the requested business", async function () {
  const rows = [{
    campaign_id: "work-a",
    campaign: { id: "work-a", businessId: "business-b", campaignType: "social",
      campaignText: "Visit us", approvalStatus: "Approved" },
    customer_interest_count: 2, latest_participation_at: "2026-09-07T10:00:00.000Z"
  }];
  const record = await resultsRepository(rows).getKnownBusiness("business-a");

  assert.deepEqual(record.customerParticipationResults, [{
    workItemId: "work-a", businessId: "business-a", name: "social", customerInterestCount: 2,
    latestParticipationAt: "2026-09-07T10:00:00.000Z"
  }]);
  assert.deepEqual(getCustomerParticipationResults(record.customerParticipationResults.concat([
    { ...record.customerParticipationResults[0], businessId: "business-b" }
  ]), "business-a"), record.customerParticipationResults);
});

test("results include approved customer-facing work only", async function () {
  const rows = [
    { campaign_id: "approved", campaign: { id: "approved", campaignType: "social", campaignText: "Welcome", promoText: "Weekend welcome",
      approvalStatus: "Approved" }, customer_interest_count: 1 },
    { campaign_id: "draft", campaign: { id: "draft", campaignType: "social", campaignText: "Draft", approvalStatus: "Unapproved" }, customer_interest_count: 9 },
    { campaign_id: "invalid-full", campaign: { id: "invalid-full", campaignType: "full", campaignText: "CAMPAIGN STRATEGY\nPrivate only",
      approvalStatus: "Approved" }, customer_interest_count: 4 }
  ];
  const record = await resultsRepository(rows).getKnownBusiness("business-a");

  assert.deepEqual(record.customerParticipationResults.map(function (result) { return result.workItemId; }), ["approved"]);
  assert.equal(record.customerParticipationResults[0].name, "Weekend welcome");
});

test("approved work with zero participation has an explicit zero state and no latest time", async function () {
  const record = await resultsRepository([{
    campaign_id: "quiet-work",
    campaign: { id: "quiet-work", campaignType: "email", campaignTypeLabel: "Email Campaign", campaignText: "Hello",
      approvalStatus: "Approved" }, customer_interest_count: 0, latest_participation_at: null
  }]).getKnownBusiness("business-a");

  assert.deepEqual(record.customerParticipationResults[0], {
    workItemId: "quiet-work", businessId: "business-a", name: "Email Campaign",
    customerInterestCount: 0, latestParticipationAt: null
  });
});

test("results use real participation counts and latest participation timestamps", async function () {
  const latest = new Date("2026-09-07T12:30:00.000Z");
  const record = await resultsRepository([{
    campaign_id: "popular-work",
    campaign: { id: "popular-work", campaignType: "social", campaignText: "Join us", approvalStatus: "Approved" },
    customer_interest_count: "3", latest_participation_at: latest
  }]).getKnownBusiness("business-a");

  assert.equal(record.customerParticipationResults[0].customerInterestCount, 3);
  assert.equal(record.customerParticipationResults[0].latestParticipationAt, latest.toISOString());
});
