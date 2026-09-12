const assert = require("node:assert/strict");
const test = require("node:test");

const authorizationPath = require.resolve("../api/_lib/demeos-business-owner-authorization.js");
const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId]/recommendation-decisions.js");

function response() {
  return {
    statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function request({
  businessId = "business-a",
  body = { recommendationTitle: "Seasonal email", suggestedCampaignType: "email", decision: "used" },
  authenticated = true,
  allowed = true,
  saveRecommendationDecision
} = {}) {
  const authorization = require(authorizationPath);
  const persistence = require(persistencePath);
  const originalAuthorize = authorization.authorizeBusinessOwnerRequest;
  const originalGetRepository = persistence.getRepository;
  const authorizationCalls = [];
  const persistenceCalls = [];
  const repository = {
    async saveRecommendationDecision(record) {
      persistenceCalls.push(record);
      if (saveRecommendationDecision) return saveRecommendationDecision(record);
      return record;
    }
  };
  authorization.authorizeBusinessOwnerRequest = async function (input) {
    authorizationCalls.push(input);
    return { authenticated, allowed };
  };
  persistence.getRepository = function () { return repository; };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  const req = {
    method: "PUT",
    query: {
      businessId, trustedIdentityId: "query-attacker", userId: "query-attacker",
      actorScope: "demeos-admin"
    },
    body: {
      ...body, businessId: "body-business", ownerId: "body-owner",
      trustedIdentityId: "body-attacker", userId: "body-attacker", actorScope: "demeos-admin"
    },
    headers: {
      host: "demeos.test", "x-user-id": "header-attacker",
      "x-identity-id": "header-attacker", "x-actor-scope": "demeos-admin"
    },
    localStorage: { trustedIdentityId: "browser-attacker", actorScope: "demeos-admin" }
  };
  const res = response();
  try {
    await handler(req, res);
  } finally {
    authorization.authorizeBusinessOwnerRequest = originalAuthorize;
    persistence.getRepository = originalGetRepository;
    delete require.cache[handlerPath];
  }
  return { res, req, repository, authorizationCalls, persistenceCalls };
}

test("unauthenticated recommendation decision request returns 401 without writing", async () => {
  const result = await request({ authenticated: false, allowed: false });
  assert.equal(result.res.statusCode, 401);
  assert.deepEqual(result.res.body, { error: "Authentication required." });
  assert.deepEqual(result.persistenceCalls, []);
});

test("authenticated non-owner cannot record a recommendation decision", async () => {
  const result = await request({ authenticated: true, allowed: false });
  assert.equal(result.res.statusCode, 403);
  assert.deepEqual(result.res.body, { error: "Forbidden." });
  assert.deepEqual(result.persistenceCalls, []);
});

test("recommendation decision validation cannot reveal behavior before authorization", async () => {
  const body = { recommendationTitle: "", suggestedCampaignType: "invalid", decision: "accepted" };
  const unauthenticated = await request({ body, authenticated: false, allowed: false });
  assert.equal(unauthenticated.res.statusCode, 401);
  assert.deepEqual(unauthenticated.res.body, { error: "Authentication required." });
  assert.deepEqual(unauthenticated.persistenceCalls, []);

  const nonOwner = await request({ body, authenticated: true, allowed: false });
  assert.equal(nonOwner.res.statusCode, 403);
  assert.deepEqual(nonOwner.res.body, { error: "Forbidden." });
  assert.deepEqual(nonOwner.persistenceCalls, []);
});

test("authenticated owner can record a valid decision for their own business", async () => {
  const result = await request();
  assert.equal(result.res.statusCode, 201);
  assert.equal(result.persistenceCalls.length, 1);
  assert.equal(result.persistenceCalls[0].businessId, "business-a");
  assert.equal(result.res.body.recommendationDecision.decision, "used");
  assert.equal(result.authorizationCalls.length, 1);
  assert.equal(result.authorizationCalls[0].req, result.req);
  assert.equal(result.authorizationCalls[0].businessId, "business-a");
  assert.equal(result.authorizationCalls[0].action, "record-recommendation-decision");
  assert.equal(result.authorizationCalls[0].repository, result.repository);
});

test("owner cannot record a recommendation decision for another business", async () => {
  const result = await request({ businessId: "business-b", allowed: false });
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.authorizationCalls[0].businessId, "business-b");
  assert.deepEqual(result.persistenceCalls, []);
});

test("URL business identity is authoritative and spoofed body identity cannot bypass ownership", async () => {
  const denied = await request({ businessId: "business-b", allowed: false });
  assert.equal(denied.res.statusCode, 403);
  assert.deepEqual(Object.keys(denied.authorizationCalls[0]).sort(), ["action", "businessId", "repository", "req"]);
  assert.equal(denied.authorizationCalls[0].businessId, "business-b");
  assert.deepEqual(denied.persistenceCalls, []);

  const allowed = await request({ businessId: "url-business" });
  assert.equal(allowed.res.statusCode, 201);
  assert.equal(allowed.authorizationCalls[0].businessId, "url-business");
  assert.equal(allowed.persistenceCalls[0].businessId, "url-business");
  assert.notEqual(allowed.persistenceCalls[0].businessId, "body-business");
});

test("recommendation decisions accept only used, modified, or rejected after authorization", async () => {
  for (const decision of ["used", "modified", "rejected"]) {
    const result = await request({ body: { recommendationTitle: "Seasonal email", suggestedCampaignType: "email", decision } });
    assert.equal(result.res.statusCode, 201);
    assert.equal(result.res.body.recommendationDecision.decision, decision);
  }
  for (const decision of ["accepted", "", null, undefined]) {
    const result = await request({ body: { recommendationTitle: "Seasonal email", suggestedCampaignType: "email", decision } });
    assert.equal(result.res.statusCode, 400);
    assert.deepEqual(result.persistenceCalls, []);
    assert.equal(result.authorizationCalls.length, 1);
  }
});

test("existing recommendation field validation remains enforced after authorization", async () => {
  for (const body of [
    { recommendationTitle: "", suggestedCampaignType: "email", decision: "used" },
    { recommendationTitle: "x".repeat(501), suggestedCampaignType: "email", decision: "used" },
    { recommendationTitle: "Valid", suggestedCampaignType: "push", decision: "used" }
  ]) {
    const result = await request({ body });
    assert.equal(result.res.statusCode, 400);
    assert.deepEqual(result.res.body, { error: "DEMEOS received invalid recommendation decision data." });
    assert.deepEqual(result.persistenceCalls, []);
  }
});

test("nonexistent business persistence result remains 404", async () => {
  const result = await request({ saveRecommendationDecision: async () => null });
  assert.equal(result.res.statusCode, 404);
  assert.deepEqual(result.res.body, { error: "Business not found." });
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
