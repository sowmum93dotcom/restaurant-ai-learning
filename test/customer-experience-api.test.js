const assert = require("node:assert/strict");
const test = require("node:test");

const persistencePath = require.resolve("../api/_lib/persistence.js");

function response() {
  return {
    statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function runHandler(handlerPath, repository, req) {
  const persistence = require(persistencePath);
  const original = persistence.getRepository;
  persistence.getRepository = function () { return repository; };
  delete require.cache[require.resolve(handlerPath)];
  const handler = require(handlerPath);
  const res = response();
  try { await handler(req, res); }
  finally { persistence.getRepository = original; delete require.cache[require.resolve(handlerPath)]; }
  return res;
}

test("customer feed returns only the deliberately public work shape", async function () {
  const work = [{
    workItemId: "campaign-a", businessId: "business-a", businessName: "North Star",
    location: "Leeds", content: "Come and see us.", participationAction: "Interested"
  }];
  const res = await runHandler("../api/customer/work.js", { async getCustomerWork() { return work; } }, { method: "GET" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { work });
  assert.deepEqual(Object.keys(res.body.work[0]).sort(), [
    "businessId", "businessName", "content", "location", "participationAction", "workItemId"
  ]);
});

test("Interested is recorded against the exact business and approved work item", async function () {
  let received;
  const repository = {
    async recordCustomerParticipation(businessId, campaignId, action) {
      received = { businessId, campaignId, action };
      return { ...received };
    }
  };
  const res = await runHandler("../api/customer/work/[campaignId]/participation.js", repository, {
    method: "POST", query: { campaignId: "campaign-a" }, body: { businessId: "business-a", action: "Interested" }
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(received, { businessId: "business-a", campaignId: "campaign-a", action: "Interested" });
  assert.deepEqual(res.body, { participation: { action: "Interested" } });
});

test("unsupported actions and work that is not approved are rejected", async function () {
  let called = false;
  const invalid = await runHandler("../api/customer/work/[campaignId]/participation.js", {
    async recordCustomerParticipation() { called = true; }
  }, { method: "POST", query: { campaignId: "campaign-a" }, body: { businessId: "business-a", action: "Pay" } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(called, false);

  const unavailable = await runHandler("../api/customer/work/[campaignId]/participation.js", {
    async recordCustomerParticipation() { return null; }
  }, { method: "POST", query: { campaignId: "campaign-a" }, body: { businessId: "business-a", action: "Interested" } });
  assert.equal(unavailable.statusCode, 404);
});

test("repository customer work query gates on approval and selects existing identity", async function () {
  let sql;
  const repository = require("../api/_lib/persistence.js").createPersistenceRepository({
    async ensureSchema() {},
    async query(statement) {
      sql = statement;
      return { rows: [{ campaign_id: "campaign-a", business_id: "business-a",
        campaign: { campaignType: "social", campaignText: "Hello", approvalStatus: "Approved", evidence: "private" },
        profile: { name: "North Star", location: "Leeds", goal: "private" } }] };
    }
  });
  const work = await repository.getCustomerWork();
  assert.match(sql, /JOIN demeos_businesses/);
  assert.match(sql, /approvalStatus.*Approved/);
  assert.deepEqual(work[0], { workItemId: "campaign-a", businessId: "business-a", businessName: "North Star",
    location: "Leeds", content: "Hello", participationAction: "Interested" });
});
