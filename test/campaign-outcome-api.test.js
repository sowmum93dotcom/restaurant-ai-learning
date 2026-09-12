const assert = require("node:assert/strict");
const test = require("node:test");

const authorizationPath = require.resolve("../api/_lib/demeos-business-owner-authorization.js");
const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId]/campaigns/[campaignId]/outcome.js");

function response() {
  return {
    statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function save({
  body = { outcome: "Positive", ownerNote: "Guests mentioned it." },
  businessId = "business-a", campaignId = "version-a", authenticated = true,
  allowed = true, saveCampaignOutcome
} = {}) {
  const authorization = require(authorizationPath);
  const persistence = require(persistencePath);
  const originalAuthorize = authorization.authorizeBusinessOwnerRequest;
  const originalGetRepository = persistence.getRepository;
  const authorizationCalls = [];
  const persistenceCalls = [];
  const repository = {
    async saveCampaignOutcome(savedBusinessId, savedCampaignId, outcome) {
      persistenceCalls.push({ businessId: savedBusinessId, campaignId: savedCampaignId, outcome });
      if (saveCampaignOutcome) return saveCampaignOutcome(savedBusinessId, savedCampaignId, outcome);
      return {
        id: savedCampaignId, businessId: savedBusinessId, campaignText: "Original content",
        approvalStatus: "Approved", outcome
      };
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
      businessId, campaignId, trustedIdentityId: "query-attacker",
      userId: "browser-clerk-attacker", actorScope: "demeos-admin"
    },
    body: {
      ...body, businessId: "body-business", campaignId: "body-campaign",
      trustedIdentityId: "body-attacker", userId: "body-clerk-attacker",
      actorScope: "demeos-admin"
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

test("unauthenticated outcome request returns 401", async function () {
  const result = await save({ authenticated: false, allowed: false });
  assert.equal(result.res.statusCode, 401);
  assert.deepEqual(result.res.body, { error: "Authentication required." });
  assert.deepEqual(result.persistenceCalls, []);
});

test("authenticated non-owner cannot record an outcome", async function () {
  const result = await save({ authenticated: true, allowed: false });
  assert.equal(result.res.statusCode, 403);
  assert.deepEqual(result.res.body, { error: "Forbidden." });
  assert.deepEqual(result.persistenceCalls, []);
});

test("outcome validation cannot reveal information before owner authorization", async function () {
  const unauthenticated = await save({
    authenticated: false,
    allowed: false,
    body: { outcome: "not-a-valid-outcome", ownerNote: {} }
  });
  assert.equal(unauthenticated.res.statusCode, 401);
  assert.deepEqual(unauthenticated.res.body, { error: "Authentication required." });
  assert.deepEqual(unauthenticated.persistenceCalls, []);

  const nonOwner = await save({
    authenticated: true,
    allowed: false,
    body: { outcome: "not-a-valid-outcome", ownerNote: {} }
  });
  assert.equal(nonOwner.res.statusCode, 403);
  assert.deepEqual(nonOwner.res.body, { error: "Forbidden." });
  assert.deepEqual(nonOwner.persistenceCalls, []);
});

test("owner can record an outcome for their own approved campaign", async function () {
  const result = await save();
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.persistenceCalls.length, 1);
  assert.equal(result.persistenceCalls[0].businessId, "business-a");
  assert.equal(result.persistenceCalls[0].campaignId, "version-a");
  assert.deepEqual(result.persistenceCalls[0].outcome, result.res.body.outcome);
  assert.equal(result.persistenceCalls[0].outcome.ownerNote, "Guests mentioned it.");
  assert.match(result.persistenceCalls[0].outcome.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(result.authorizationCalls.length, 1);
  assert.equal(result.authorizationCalls[0].req, result.req);
  assert.equal(result.authorizationCalls[0].businessId, "business-a");
  assert.equal(result.authorizationCalls[0].action, "record-campaign-outcome");
  assert.equal(result.authorizationCalls[0].repository, result.repository);
});

test("owner cannot record an outcome for another business", async function () {
  const result = await save({ businessId: "business-b", allowed: false });
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.authorizationCalls[0].businessId, "business-b");
  assert.deepEqual(result.persistenceCalls, []);
});

test("wrong campaign and business combination fails safely", async function () {
  const result = await save({
    campaignId: "campaign-from-business-b",
    saveCampaignOutcome: async function () { return null; }
  });
  assert.equal(result.res.statusCode, 409);
  assert.match(result.res.body.error, /approved campaign belonging to this business/);
  assert.equal(result.persistenceCalls[0].businessId, "business-a");
  assert.equal(result.persistenceCalls[0].campaignId, "campaign-from-business-b");
});

test("spoofed identity and actor scope cannot bypass ownership", async function () {
  const result = await save({ allowed: false });
  assert.equal(result.res.statusCode, 403);
  assert.deepEqual(Object.keys(result.authorizationCalls[0]).sort(), ["action", "businessId", "repository", "req"]);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "trustedIdentityId"), false);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "actorScope"), false);
  assert.deepEqual(result.persistenceCalls, []);
});

test("existing outcome validation still runs after authorization", async function () {
  for (const body of [
    { outcome: "Great" }, { outcome: "" }, { outcome: null }, { outcome: 42 },
    { outcome: "Positive", ownerNote: {} }
  ]) {
    const result = await save({ body });
    assert.equal(result.res.statusCode, 400);
    assert.deepEqual(result.res.body, { error: "DEMEOS received invalid campaign outcome data." });
    assert.equal(result.authorizationCalls.length, 1);
    assert.deepEqual(result.persistenceCalls, []);
  }
});

test("existing approved-campaign requirement remains enforced", async function () {
  const result = await save({ saveCampaignOutcome: async function () { return null; } });
  assert.equal(result.res.statusCode, 409);
  assert.match(result.res.body.error, /Only an approved campaign belonging to this business/);
});

test("route identifiers remain authoritative over body values", async function () {
  const result = await save({ businessId: "url-business", campaignId: "url-campaign" });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.authorizationCalls[0].businessId, "url-business");
  assert.equal(result.persistenceCalls[0].businessId, "url-business");
  assert.equal(result.persistenceCalls[0].campaignId, "url-campaign");
  assert.equal(result.persistenceCalls[0].outcome.businessId, "url-business");
  assert.equal(result.persistenceCalls[0].outcome.campaignId, "url-campaign");
});

test("unsupported methods and malformed route identifiers preserve existing responses", async function () {
  const authorization = require(authorizationPath);
  const persistence = require(persistencePath);
  const originalAuthorize = authorization.authorizeBusinessOwnerRequest;
  const originalGetRepository = persistence.getRepository;
  let authorized = false;
  authorization.authorizeBusinessOwnerRequest = async function () { authorized = true; };
  persistence.getRepository = function () { return {}; };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  try {
    const methodResponse = response();
    await handler({ method: "POST", query: {}, body: {} }, methodResponse);
    assert.equal(methodResponse.statusCode, 405);
    assert.equal(methodResponse.headers.Allow, "PUT");

    const malformedResponse = response();
    await handler({ method: "PUT", query: { businessId: " ", campaignId: "version-a" }, body: {} }, malformedResponse);
    assert.equal(malformedResponse.statusCode, 400);
    assert.equal(authorized, false);
  } finally {
    authorization.authorizeBusinessOwnerRequest = originalAuthorize;
    persistence.getRepository = originalGetRepository;
    delete require.cache[handlerPath];
  }
});
