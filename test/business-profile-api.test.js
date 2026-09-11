const assert = require("node:assert/strict");
const test = require("node:test");

const authorizationPath = require.resolve("../api/_lib/demeos-business-owner-authorization.js");
const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId].js");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    ended: false,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
    setHeader() {}
  };
}

function completeProfile(overrides) {
  return {
    name: "DEMEOS Kitchen",
    type: "Restaurant",
    location: "London",
    brandVoice: "Warm and welcoming",
    targetCustomer: "Local families",
    goal: "Increase reservations",
    ...overrides
  };
}

async function invoke({
  method = "GET",
  businessId = "business-a",
  body,
  authenticated = true,
  allowed = true,
  knownBusiness = { businessId: "business-a", businessProfile: completeProfile() }
} = {}) {
  const authorization = require(authorizationPath);
  const persistence = require(persistencePath);
  const originalAuthorize = authorization.authorizeBusinessOwnerRequest;
  const originalGetRepository = persistence.getRepository;
  const authorizationCalls = [];
  const savedProfiles = [];
  const repository = {
    async isBusinessOwnedByIdentity() { throw new Error("gateway should own the lookup"); },
    async getKnownBusiness(id) { return knownBusiness && { ...knownBusiness, businessId: id }; },
    async saveBusiness(profile) { savedProfiles.push(profile); }
  };
  authorization.authorizeBusinessOwnerRequest = async function (input) {
    authorizationCalls.push(input);
    return { authenticated, allowed };
  };
  persistence.getRepository = function () { return repository; };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  const request = {
    method,
    query: { businessId, trustedIdentityId: "query-attacker", userId: "query-user" },
    body,
    headers: { host: "demeos.test", "x-user-id": "header-attacker" },
    localStorage: { selectedBusiness: businessId }
  };
  const response = createResponse();

  try {
    await handler(request, response);
  } finally {
    authorization.authorizeBusinessOwnerRequest = originalAuthorize;
    persistence.getRepository = originalGetRepository;
    delete require.cache[handlerPath];
  }
  return { response, request, repository, authorizationCalls, savedProfiles };
}

test("unauthenticated profile GET and PUT requests return 401", async function () {
  for (const method of ["GET", "PUT"]) {
    const result = await invoke({ method, body: { businessProfile: completeProfile() }, authenticated: false, allowed: false });
    assert.equal(result.response.statusCode, 401);
    assert.deepEqual(result.savedProfiles, []);
  }
});

test("an authenticated non-owner cannot GET or PUT a business profile", async function () {
  for (const method of ["GET", "PUT"]) {
    const result = await invoke({ method, body: { businessProfile: completeProfile() }, allowed: false });
    assert.equal(result.response.statusCode, 403);
    assert.deepEqual(result.savedProfiles, []);
  }
});

test("an authenticated owner can GET their own business profile", async function () {
  const result = await invoke();
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.body.businessId, "business-a");
  assert.equal(result.authorizationCalls[0].businessId, "business-a");
  assert.equal(result.authorizationCalls[0].repository, result.repository);
  assert.equal(result.authorizationCalls[0].action, "manage-business-profile");
  assert.equal(result.authorizationCalls[0].req, result.request);
});

test("an authenticated owner can PUT their own valid profile", async function () {
  const profile = completeProfile();
  const result = await invoke({ method: "PUT", body: { businessProfile: profile } });
  assert.equal(result.response.statusCode, 204);
  assert.equal(result.response.ended, true);
  assert.deepEqual(result.savedProfiles, [{ ...profile, businessId: "business-a" }]);
});

test("an owner cannot access another business", async function () {
  const result = await invoke({ businessId: "business-b", allowed: false });
  assert.equal(result.response.statusCode, 403);
  assert.equal(result.authorizationCalls[0].businessId, "business-b");
});

test("spoofed identity, actor scope, and browser state are passed only to trusted authentication", async function () {
  const result = await invoke({
    method: "PUT",
    allowed: false,
    body: {
      businessProfile: completeProfile(),
      trustedIdentityId: "body-attacker",
      userId: "body-user",
      actorScope: "business-owner"
    }
  });
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.savedProfiles, []);
  assert.equal(result.authorizationCalls.length, 1);
  assert.equal(result.authorizationCalls[0].req, result.request);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "trustedIdentityId"), false);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "actorScope"), false);
});

test("profile validation still runs after successful authorization", async function () {
  for (const profile of [completeProfile({ brandVoice: " \n\t " }), { ...completeProfile(), targetCustomer: undefined }]) {
    const result = await invoke({ method: "PUT", body: { businessProfile: profile } });
    assert.equal(result.response.statusCode, 400);
    assert.deepEqual(result.response.body, {
      error: "Please complete all Business Manager Profile fields before saving."
    });
    assert.deepEqual(result.savedProfiles, []);
    assert.equal(result.authorizationCalls.length, 1);
  }
});

test("the URL businessId remains authoritative", async function () {
  const result = await invoke({
    method: "PUT",
    businessId: "url-business",
    body: { businessProfile: completeProfile({ businessId: "body-business" }) }
  });
  assert.equal(result.response.statusCode, 204);
  assert.equal(result.savedProfiles[0].businessId, "url-business");
  assert.equal(result.authorizationCalls[0].businessId, "url-business");
});

test("authorized GET preserves the existing not-found response", async function () {
  const result = await invoke({ knownBusiness: null });
  assert.equal(result.response.statusCode, 404);
  assert.deepEqual(result.response.body, { error: "Business not found." });
});
