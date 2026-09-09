const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  authorizeBusinessOwnerRequest
} = require("../api/_lib/demeos-business-owner-authorization.js");

const request = { method: "GET", url: "/owner", headers: { host: "demeos.test" } };
const ownerAction = "create-marketing";

function repositoryFor(mappings, calls = []) {
  return {
    calls,
    async isBusinessOwnedByIdentity(identity, businessId) {
      calls.push([identity, businessId]);
      return mappings.some(([owner, business]) => owner === identity && business === businessId);
    }
  };
}

function authentication(userId, extras = {}) {
  return {
    authenticateRequest: async () => ({
      isAuthenticated: true,
      toAuth: () => ({ userId, ...extras })
    })
  };
}

async function authorize(overrides = {}) {
  const previousSecret = process.env.CLERK_SECRET_KEY;
  const previousPublishable = process.env.CLERK_PUBLISHABLE_KEY;
  process.env.CLERK_SECRET_KEY = "sk_test_gateway";
  process.env.CLERK_PUBLISHABLE_KEY = "pk_test_gateway";
  try {
    return await authorizeBusinessOwnerRequest({
      req: request,
      businessId: "business-a",
      action: ownerAction,
      repository: repositoryFor([["identity-a", "business-a"]]),
      authenticationOptions: authentication("identity-a"),
      ...overrides
    });
  } finally {
    if (previousSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previousSecret;
    if (previousPublishable === undefined) delete process.env.CLERK_PUBLISHABLE_KEY;
    else process.env.CLERK_PUBLISHABLE_KEY = previousPublishable;
  }
}

test("verified identity owning the exact business is authorized", async () => {
  const result = await authorize();
  assert.equal(result.allowed, true);
  assert.equal(result.authorization.allowed, true);
  assert.equal(result.actorContext.trustedIdentityId, "identity-a");
  assert.equal(result.actorContext.businessId, "business-a");
});

test("valid authentication is denied for a wrong or differently owned business", async () => {
  assert.equal((await authorize({ businessId: "business-b" })).allowed, false);
  assert.equal((await authorize({ authenticationOptions: authentication("identity-b") })).allowed, false);
});

test("unauthenticated requests fail closed", async () => {
  const result = await authorize({
    authenticationOptions: { authenticateRequest: async () => ({ isAuthenticated: false }) }
  });
  assert.equal(result.allowed, false);
  assert.equal(result.actorContext.state, "unresolved");
});

test("missing and blank required identifiers fail closed without ownership lookup", async () => {
  for (const overrides of [
    { businessId: undefined },
    { businessId: "  " },
    { action: undefined },
    { action: "\t" }
  ]) {
    const calls = [];
    const result = await authorize({ ...overrides, repository: repositoryFor([], calls) });
    assert.equal(result.allowed, false);
    assert.deepEqual(calls, []);
  }
});

test("unsupported owner actions are denied by centralized authorization", async () => {
  const result = await authorize({ action: "unsupported-owner-action" });
  assert.equal(result.allowed, false);
  assert.equal(result.authorization.allowed, false);
  assert.equal(result.authorization.action, "unsupported-owner-action");
});

test("client claims cannot substitute for verified authentication", async () => {
  const claims = [
    { businessId: "business-a" },
    { actorScope: "business-owner" },
    { body: { trustedIdentityId: "identity-a" } },
    { query: { trustedIdentityId: "identity-a" } },
    { headers: { host: "demeos.test", "x-user-id": "identity-a", "x-identity-id": "identity-a" } },
    { localStorage: { trustedIdentityId: "identity-a" }, browser: { selectedBusiness: "business-a" } },
    { jwt: { payload: { sub: "identity-a", actorScope: "business-owner" } } }
  ];
  for (const claim of claims) {
    const result = await authorize({
      req: { ...request, ...claim },
      authenticationOptions: { authenticateRequest: async () => ({ isAuthenticated: false }) }
    });
    assert.equal(result.allowed, false);
  }
});

test("authentication and ownership exceptions fail closed", async () => {
  assert.equal((await authorize({
    authenticationOptions: { authenticateRequest: async () => { throw new Error("secret auth error"); } }
  })).allowed, false);
  assert.equal((await authorize({
    repository: { isBusinessOwnedByIdentity: async () => { throw new Error("secret database error"); } }
  })).allowed, false);
});

test("the exact requested business is used throughout the authorization chain", async () => {
  const calls = [];
  const result = await authorize({ repository: repositoryFor([["identity-a", "business-a"]], calls) });
  assert.deepEqual(calls, [["identity-a", "business-a"]]);
  assert.equal(result.authorization.businessId, "business-a");

  const crossBusiness = await authorize({
    businessId: "business-b",
    repository: repositoryFor([["identity-a", "business-a"]])
  });
  assert.equal(crossBusiness.allowed, false);
});

test("results are immutable and expose only the gateway contract", async () => {
  const result = await authorize({
    authenticationOptions: authentication("identity-a", {
      sessionId: "session-secret",
      token: "token-secret",
      securityReasoning: "internal-secret"
    })
  });
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Object.keys(result).sort(), ["actorContext", "allowed", "authorization"]);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.throws(() => Object.defineProperty(result, "allowed", { value: false }));
});

test("gateway delegates persistence and permission decisions to existing authorities", () => {
  const source = fs.readFileSync(path.join(__dirname,
    "../api/_lib/demeos-business-owner-authorization.js"), "utf8");
  assert.equal(/\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(source), false);
  assert.equal(source.includes("permissionsByActorScope"), false);
  assert.equal(source.includes("resolveBusinessOwnerContext"), true);
  assert.equal(source.includes("authorizeDemeosAction"), true);
});
