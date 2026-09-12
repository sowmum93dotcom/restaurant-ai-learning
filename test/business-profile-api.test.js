const assert = require("node:assert/strict");
const test = require("node:test");

const authorizationPath = require.resolve("../api/_lib/demeos-business-owner-authorization.js");
const authenticationPath = require.resolve("../api/_lib/demeos-authentication.js");
const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId].js");
const { DEMEOS_ACTIONS } = require("../api/_lib/demeos-rules.js");

function createResponse() {
  return {
    statusCode: null, body: null, ended: false,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
    setHeader() {}
  };
}

function completeProfile(overrides) {
  return { name: "DEMEOS Kitchen", type: "Restaurant", location: "London",
    brandVoice: "Warm and welcoming", targetCustomer: "Local families",
    goal: "Increase reservations", ...overrides };
}

async function invoke({
  method = "GET", businessId = "business-a", body, authenticated = true, allowed = true,
  knownBusiness = { businessId: "business-a", businessProfile: completeProfile() },
  createAllowed = false, trustedIdentityId = "trusted-owner"
} = {}) {
  const authorization = require(authorizationPath);
  const authentication = require(authenticationPath);
  const persistence = require(persistencePath);
  const originalAuthorize = authorization.authorizeBusinessOwnerRequest;
  const originalResolveIdentity = authentication.resolveTrustedIdentityFromRequest;
  const originalGetRepository = persistence.getRepository;
  const authorizationCalls = [];
  const identityCalls = [];
  const savedProfiles = [];
  const createdBusinesses = [];
  const knownBusinessReads = [];
  const repository = {
    async isBusinessOwnedByIdentity() { throw new Error("gateway should own the lookup"); },
    async getKnownBusiness(id) {
      knownBusinessReads.push(id);
      return knownBusiness && { ...knownBusiness, businessId: id };
    },
    async saveBusiness(profile) { savedProfiles.push(profile); },
    async createBusinessForOwner(identity, profile) {
      createdBusinesses.push({ identity, profile });
      return createAllowed ? { trustedIdentityId: identity, businessId: profile.businessId } : null;
    }
  };
  authorization.authorizeBusinessOwnerRequest = async function (input) {
    authorizationCalls.push(input);
    return { authenticated, allowed };
  };
  authentication.resolveTrustedIdentityFromRequest = async function (request) {
    identityCalls.push(request);
    return authenticated ? { trustedIdentityId, provider: "clerk" } : null;
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
    authentication.resolveTrustedIdentityFromRequest = originalResolveIdentity;
    persistence.getRepository = originalGetRepository;
    delete require.cache[handlerPath];
  }
  return {
    response, request, repository, authorizationCalls, identityCalls, savedProfiles,
    createdBusinesses, knownBusinessReads
  };
}

test("unauthenticated profile GET and PUT requests return 401", async function () {
  for (const method of ["GET", "PUT"]) {
    const result = await invoke({ method, body: { businessProfile: completeProfile() }, authenticated: false, allowed: false });
    assert.equal(result.response.statusCode, 401);
    assert.deepEqual(result.response.body, { error: "Authentication required." });
    assert.deepEqual(result.savedProfiles, []);
    assert.deepEqual(result.createdBusinesses, []);
    assert.deepEqual(result.knownBusinessReads, []);
  }
});

test("an authenticated non-owner cannot GET or overwrite an existing business profile", async function () {
  for (const method of ["GET", "PUT"]) {
    const result = await invoke({ method, body: { businessProfile: completeProfile() }, allowed: false, createAllowed: false });
    assert.equal(result.response.statusCode, 403);
    assert.deepEqual(result.response.body, { error: "Forbidden." });
    assert.deepEqual(result.savedProfiles, []);
    assert.deepEqual(result.knownBusinessReads, []);
  }
});

test("an authenticated owner can GET their own business profile", async function () {
  const result = await invoke();
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.body.businessId, "business-a");
  assert.equal(result.authorizationCalls[0].businessId, "business-a");
  assert.equal(result.authorizationCalls[0].repository, result.repository);
  assert.equal(result.authorizationCalls[0].action, DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS);
  assert.equal(result.authorizationCalls[0].req, result.request);
  assert.deepEqual(result.knownBusinessReads, ["business-a"]);
});

test("an authenticated owner can PUT their own valid profile", async function () {
  const profile = completeProfile();
  const result = await invoke({ method: "PUT", body: { businessProfile: profile } });
  assert.equal(result.response.statusCode, 204);
  assert.equal(result.response.ended, true);
  assert.deepEqual(result.savedProfiles, [{ ...profile, businessId: "business-a" }]);
  assert.deepEqual(result.createdBusinesses, []);
  assert.equal(result.authorizationCalls[0].action, DEMEOS_ACTIONS.MANAGE_BUSINESS_PROFILE);
});

test("a signed-in user can create a brand-new business and receive first ownership atomically", async function () {
  const profile = completeProfile();
  const result = await invoke({
    method: "PUT", businessId: "new-business", body: { businessProfile: profile },
    allowed: false, createAllowed: true, trustedIdentityId: "verified-owner"
  });
  assert.equal(result.response.statusCode, 204);
  assert.deepEqual(result.savedProfiles, []);
  assert.deepEqual(result.createdBusinesses, [{
    identity: "verified-owner", profile: { ...profile, businessId: "new-business" }
  }]);
  assert.equal(result.identityCalls.length, 1);
  assert.equal(result.identityCalls[0], result.request);
});

test("an owner cannot access another business", async function () {
  const result = await invoke({ businessId: "business-b", allowed: false });
  assert.equal(result.response.statusCode, 403);
  assert.equal(result.authorizationCalls[0].businessId, "business-b");
  assert.deepEqual(result.knownBusinessReads, []);
});

test("spoofed GET identities cannot bypass ownership of the route business", async function () {
  const result = await invoke({
    businessId: "business-b",
    allowed: false,
    body: { trustedIdentityId: "owner-b", userId: "owner-b", actorScope: "business-owner" }
  });

  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: "Forbidden." });
  assert.equal(result.authorizationCalls[0].businessId, "business-b");
  assert.equal(result.authorizationCalls[0].req, result.request);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "trustedIdentityId"), false);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "actorScope"), false);
  assert.deepEqual(result.knownBusinessReads, []);
});

test("spoofed identity, actor scope, and browser state cannot claim an existing business", async function () {
  const result = await invoke({
    method: "PUT", allowed: false, createAllowed: false, trustedIdentityId: "verified-owner",
    body: { businessProfile: completeProfile(), trustedIdentityId: "body-attacker",
      userId: "body-user", actorScope: "business-owner" }
  });
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.savedProfiles, []);
  assert.equal(result.authorizationCalls.length, 1);
  assert.equal(result.authorizationCalls[0].req, result.request);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "trustedIdentityId"), false);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "actorScope"), false);
  assert.equal(result.createdBusinesses[0].identity, "verified-owner");
  assert.notEqual(result.createdBusinesses[0].identity, "body-attacker");
});

test("profile validation still runs after authentication", async function () {
  for (const profile of [completeProfile({ brandVoice: " \n\t " }), { ...completeProfile(), targetCustomer: undefined }]) {
    const result = await invoke({ method: "PUT", body: { businessProfile: profile } });
    assert.equal(result.response.statusCode, 400);
    assert.deepEqual(result.response.body, { error: "Please complete all Business Manager Profile fields before saving." });
    assert.deepEqual(result.savedProfiles, []);
    assert.deepEqual(result.createdBusinesses, []);
    assert.equal(result.authorizationCalls.length, 1);
  }
});

test("the URL businessId remains authoritative", async function () {
  const result = await invoke({ method: "PUT", businessId: "url-business",
    body: { businessProfile: completeProfile({ businessId: "body-business" }) } });
  assert.equal(result.response.statusCode, 204);
  assert.equal(result.savedProfiles[0].businessId, "url-business");
  assert.equal(result.authorizationCalls[0].businessId, "url-business");
});

test("authorized GET preserves the existing not-found response", async function () {
  const result = await invoke({ knownBusiness: null });
  assert.equal(result.response.statusCode, 404);
  assert.deepEqual(result.response.body, { error: "Business not found." });
});
