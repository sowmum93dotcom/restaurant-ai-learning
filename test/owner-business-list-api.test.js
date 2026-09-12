const assert = require("node:assert/strict");
const test = require("node:test");

const authenticationPath = require.resolve("../api/_lib/demeos-authentication.js");
const persistencePath = require.resolve("../api/_lib/persistence.js");
const rulesPath = require.resolve("../api/_lib/demeos-rules.js");
const handlerPath = require.resolve("../api/businesses.js");

function response() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; }
  };
}

async function invoke({
  identity = { trustedIdentityId: "verified-owner", provider: "clerk" },
  businesses = [],
  method = "GET",
  permissionAllowed = true,
  request = {}
} = {}) {
  const authentication = require(authenticationPath);
  const persistence = require(persistencePath);
  const rules = require(rulesPath);
  const originalResolve = authentication.resolveTrustedIdentityFromRequest;
  const originalRepository = persistence.getRepository;
  const originalCanPerform = rules.canPerformDemeosAction;
  const calls = [];

  authentication.resolveTrustedIdentityFromRequest = async function (req) {
    calls.push(["authenticate", req]);
    return identity;
  };
  rules.canPerformDemeosAction = function (authorizationRequest) {
    calls.push(["authorize", authorizationRequest]);
    return permissionAllowed;
  };
  persistence.getRepository = function () {
    calls.push(["repository"]);
    return {
      async getOwnedBusinessProfiles(trustedIdentityId) {
        calls.push(["ownership", trustedIdentityId]);
        return businesses;
      }
    };
  };

  delete require.cache[handlerPath];
  const req = {
    method,
    headers: { host: "demeos.test", "x-user-id": "attacker", "x-demeos-role": "business-owner" },
    query: { trustedIdentityId: "attacker", userId: "attacker", actorScope: "business-owner", businessId: "rival" },
    body: { trustedIdentityId: "attacker", userId: "attacker", actorScope: "business-owner", businessId: "rival" },
    ...request
  };
  const res = response();

  try {
    await require(handlerPath)(req, res);
  } finally {
    authentication.resolveTrustedIdentityFromRequest = originalResolve;
    persistence.getRepository = originalRepository;
    rules.canPerformDemeosAction = originalCanPerform;
    delete require.cache[handlerPath];
  }
  return { req, res, calls };
}

test("owner business list rejects unsupported methods", async function () {
  const result = await invoke({ method: "POST" });
  assert.equal(result.res.statusCode, 405);
  assert.deepEqual(result.res.body, { error: "Method not allowed" });
  assert.equal(result.res.headers.Allow, "GET");
  assert.deepEqual(result.calls, []);
});

test("owner business list exposes nothing without a verified Clerk identity", async function () {
  const result = await invoke({ identity: null, businesses: [{ businessId: "private" }] });
  assert.equal(result.res.statusCode, 401);
  assert.deepEqual(result.res.body, { error: "Authentication required." });
  assert.deepEqual(result.calls.map(function (call) { return call[0]; }), ["authenticate"]);
});

test("trusted owner permission governs listing before owned profiles are loaded", async function () {
  const businesses = [{ businessId: "a", name: "Alpha" }, { businessId: "b", name: "Beta" }];
  const result = await invoke({ businesses });
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(result.res.body, { businesses });
  assert.deepEqual(result.calls.map(function (call) { return call[0]; }), [
    "authenticate", "authorize", "repository", "ownership"
  ]);
  assert.deepEqual(result.calls[1][1], {
    actorScope: "business-owner",
    action: "view-own-business-results"
  });
});

test("permission denial returns forbidden without loading owned profiles", async function () {
  const result = await invoke({ permissionAllowed: false, businesses: [{ businessId: "private" }] });
  assert.equal(result.res.statusCode, 403);
  assert.deepEqual(result.res.body, { error: "Forbidden." });
  assert.deepEqual(result.calls.map(function (call) { return call[0]; }), ["authenticate", "authorize"]);
});

test("only the trusted Clerk identity reaches ownership resolution despite spoofed request values", async function () {
  const result = await invoke({
    identity: { trustedIdentityId: "real-owner", provider: "clerk" },
    businesses: [{ businessId: "owned", name: "Owned Cafe" }]
  });
  assert.deepEqual(result.calls.find(function (call) { return call[0] === "ownership"; }), ["ownership", "real-owner"]);
  assert.notEqual("real-owner", result.req.query.trustedIdentityId);
  assert.notEqual("real-owner", result.req.body.userId);
  assert.notEqual("real-owner", result.req.headers["x-user-id"]);
});

test("an authenticated permitted owner with no businesses receives an empty list", async function () {
  const result = await invoke({ businesses: [] });
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(result.res.body, { businesses: [] });
});

test("browser-supplied cross-owner profiles are never introduced into the repository result", async function () {
  const owned = [{ businessId: "owned", name: "Owned Cafe" }];
  const result = await invoke({
    businesses: owned,
    request: {
      body: {
        businesses: [{ businessId: "rival", name: "Rival Cafe" }],
        businessId: "rival",
        trustedIdentityId: "rival-owner"
      }
    }
  });
  assert.deepEqual(result.res.body, { businesses: owned });
  assert.doesNotMatch(JSON.stringify(result.res.body), /Rival Cafe|rival-owner/);
});
