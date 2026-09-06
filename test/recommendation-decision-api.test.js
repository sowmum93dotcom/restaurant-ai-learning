const assert = require("node:assert/strict");
const test = require("node:test");

const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId]/recommendation-decisions.js");

function response() {
  return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
}

async function request(businessId, body, save) {
  const original = require(persistencePath).getRepository;
  require(persistencePath).getRepository = function () { return { saveRecommendationDecision: save }; };
  delete require.cache[handlerPath];
  const res = response();
  try {
    await require(handlerPath)({ method: "PUT", query: { businessId }, body }, res);
  } finally {
    require(persistencePath).getRepository = original; delete require.cache[handlerPath];
  }
  return res;
}

test("recommendation decisions accept only used, modified, or rejected", async () => {
  for (const decision of ["used", "modified", "rejected"]) {
    const res = await request("business-a", { recommendationTitle: "Seasonal email", suggestedCampaignType: "email", decision }, async (record) => record);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.recommendationDecision.decision, decision);
  }
  for (const decision of ["accepted", "", null, undefined]) {
    let writes = 0;
    const res = await request("business-a", { recommendationTitle: "Seasonal email", suggestedCampaignType: "email", decision }, async () => { writes += 1; });
    assert.equal(res.statusCode, 400); assert.equal(writes, 0);
  }
});

test("the URL business identity is authoritative for recommendation decisions", async () => {
  let saved;
  const res = await request("business-a", {
    businessId: "business-b", recommendationTitle: "Local post", suggestedCampaignType: "social", decision: "used"
  }, async (record) => { saved = record; return record; });
  assert.equal(res.statusCode, 201);
  assert.equal(saved.businessId, "business-a");
  assert.notEqual(saved.businessId, "business-b");
});

test("a business cannot write a recommendation decision when its URL identity does not exist", async () => {
  const res = await request("business-b", {
    recommendationTitle: "Local post", suggestedCampaignType: "social", decision: "rejected"
  }, async () => null);
  assert.equal(res.statusCode, 404);
});

test("repository scopes restored decisions and writes to one business", async () => {
  const { createPersistenceRepository } = require("../api/_lib/persistence.js");
  const calls = [];
  const database = { async ensureSchema() {}, async query(sql, values) {
    calls.push({ sql, values });
    if (sql.startsWith("SELECT profile")) return { rows: [{ profile: { name: "Alpha" } }] };
    if (sql.includes("FROM demeos_campaigns")) return { rows: [] };
    if (sql.startsWith("SELECT recommendation_title")) return { rows: [{ recommendation_title: "Alpha idea", suggested_campaign_type: "full", decision: "rejected", decided_at: "2026-09-06T00:00:00.000Z" }] };
    return { rows: [{ decision: values[3] }] };
  } };
  const repository = createPersistenceRepository(database);
  const restored = await repository.getKnownBusiness("business-a");
  assert.deepEqual(restored.recommendationDecisions, [{ businessId: "business-a", recommendationTitle: "Alpha idea", suggestedCampaignType: "full", decision: "rejected", timestamp: "2026-09-06T00:00:00.000Z" }]);
  assert.match(calls[2].sql, /WHERE business_id = \$1/);
  assert.deepEqual(calls[2].values, ["business-a"]);

  await repository.saveRecommendationDecision({ businessId: "business-b", recommendationTitle: "Beta idea", suggestedCampaignType: "email", decision: "modified", timestamp: "2026-09-06T01:00:00.000Z" });
  assert.match(calls[3].sql, /WHERE EXISTS.*business_id = \$1/s);
  assert.deepEqual(calls[3].values, ["business-b", "Beta idea", "email", "modified", "2026-09-06T01:00:00.000Z"]);
});
