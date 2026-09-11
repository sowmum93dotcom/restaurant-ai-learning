const assert = require("node:assert/strict");
const test = require("node:test");

const authenticationPath = require.resolve("../api/_lib/demeos-authentication.js");
const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses.js");

function response() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }, setHeader() {} };
}

async function invoke(identity, businesses) {
  const authentication = require(authenticationPath);
  const persistence = require(persistencePath);
  const originalResolve = authentication.resolveTrustedIdentityFromRequest;
  const originalRepository = persistence.getRepository;
  const calls = [];
  authentication.resolveTrustedIdentityFromRequest = async function (req) {
    calls.push(["authenticate", req]); return identity;
  };
  persistence.getRepository = function () { return { async getOwnedBusinessProfiles(id) {
    calls.push(["ownership", id]); return businesses;
  } }; };
  delete require.cache[handlerPath];
  const req = { method: "GET", headers: { host: "demeos.test", "x-user-id": "attacker" },
    query: { trustedIdentityId: "attacker", actorScope: "admin" },
    body: { trustedIdentityId: "attacker", actorScope: "business-owner" } };
  const res = response();
  try { await require(handlerPath)(req, res); } finally {
    authentication.resolveTrustedIdentityFromRequest = originalResolve;
    persistence.getRepository = originalRepository;
    delete require.cache[handlerPath];
  }
  return { req, res, calls };
}

test("owner business list exposes nothing without a verified Clerk identity", async function () {
  const result = await invoke(null, [{ businessId: "private" }]);
  assert.equal(result.res.statusCode, 401);
  assert.deepEqual(result.calls.map(function (call) { return call[0]; }), ["authenticate"]);
});

test("owner business list returns all and only profiles resolved for the trusted identity", async function () {
  const businesses = [{ businessId: "a", name: "Alpha" }, { businessId: "b", name: "Beta" }];
  const result = await invoke({ trustedIdentityId: "verified-owner", provider: "clerk" }, businesses);
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(result.res.body, { businesses });
  assert.deepEqual(result.calls[1], ["ownership", "verified-owner"]);
});

test("spoofed identity and actorScope values never reach ownership resolution", async function () {
  const result = await invoke({ trustedIdentityId: "real-owner", provider: "clerk" }, [{ businessId: "real" }]);
  assert.deepEqual(result.calls[1], ["ownership", "real-owner"]);
  assert.notEqual(result.calls[1][1], result.req.query.trustedIdentityId);
});
