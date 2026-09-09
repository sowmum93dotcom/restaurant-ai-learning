const assert = require("node:assert/strict");
const test = require("node:test");

const authenticationPath = require.resolve("../api/_lib/demeos-authentication.js");
const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/bootstrap-owner.js");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function invoke({
  enabled,
  method = "POST",
  body = { businessId: "business-a" },
  identity = { trustedIdentityId: "clerk-user" },
  assignment = { businessId: "business-a" }
} = {}) {
  const previousFlag = process.env.DEMEOS_OWNER_BOOTSTRAP_ENABLED;
  const authentication = require(authenticationPath);
  const persistence = require(persistencePath);
  const originalResolve = authentication.resolveTrustedIdentityFromRequest;
  const originalGetRepository = persistence.getRepository;
  const authenticationCalls = [];
  const assignmentCalls = [];

  if (enabled === undefined) delete process.env.DEMEOS_OWNER_BOOTSTRAP_ENABLED;
  else process.env.DEMEOS_OWNER_BOOTSTRAP_ENABLED = enabled;

  authentication.resolveTrustedIdentityFromRequest = async function (request) {
    authenticationCalls.push(request);
    return identity;
  };
  persistence.getRepository = function () {
    return {
      async assignBusinessOwner(trustedIdentityId, businessId) {
        assignmentCalls.push([trustedIdentityId, businessId]);
        return assignment;
      }
    };
  };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  const request = {
    method,
    body,
    query: { trustedIdentityId: "query-attacker" },
    headers: { "x-user-id": "header-attacker" }
  };
  const response = createResponse();

  try {
    await handler(request, response);
  } finally {
    authentication.resolveTrustedIdentityFromRequest = originalResolve;
    persistence.getRepository = originalGetRepository;
    delete require.cache[handlerPath];
    if (previousFlag === undefined) delete process.env.DEMEOS_OWNER_BOOTSTRAP_ENABLED;
    else process.env.DEMEOS_OWNER_BOOTSTRAP_ENABLED = previousFlag;
  }

  return { response, request, authenticationCalls, assignmentCalls };
}

test("ownership bootstrap is disabled by default", async function () {
  const result = await invoke();

  assert.equal(result.response.statusCode, 404);
  assert.deepEqual(result.authenticationCalls, []);
  assert.deepEqual(result.assignmentCalls, []);
});

test("ownership bootstrap accepts POST only", async function () {
  const result = await invoke({ enabled: "true", method: "GET" });

  assert.equal(result.response.statusCode, 405);
  assert.equal(result.response.headers.Allow, "POST");
  assert.deepEqual(result.authenticationCalls, []);
  assert.deepEqual(result.assignmentCalls, []);
});

test("only the exact enabled value opens the bootstrap", async function () {
  for (const enabled of ["TRUE", "1", " true ", "false"]) {
    const result = await invoke({ enabled });
    assert.equal(result.response.statusCode, 404);
    assert.deepEqual(result.assignmentCalls, []);
  }
});

test("an unauthenticated request cannot assign ownership", async function () {
  const result = await invoke({ enabled: "true", identity: null });

  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.assignmentCalls, []);
});

test("request-supplied identity claims cannot affect the assignment", async function () {
  const result = await invoke({
    enabled: "true",
    body: {
      businessId: "business-a",
      trustedIdentityId: "body-attacker",
      userId: "body-user",
      actorScope: "admin",
      ownerIdentity: "body-owner"
    }
  });

  assert.deepEqual(result.assignmentCalls, [["clerk-user", "business-a"]]);
  assert.equal(result.authenticationCalls[0], result.request);
});

test("missing and invalid business IDs fail without an assignment", async function () {
  for (const body of [null, {}, { businessId: "  " }, { businessId: 42 }]) {
    const result = await invoke({ enabled: "true", body });
    assert.equal(result.response.statusCode, 400);
    assert.deepEqual(result.assignmentCalls, []);
  }
});

test("a nonexistent business returns a generic not-found response", async function () {
  const result = await invoke({ enabled: "true", assignment: null });

  assert.equal(result.response.statusCode, 404);
  assert.deepEqual(result.response.body, { error: "Business not found." });
});

test("the authenticated Clerk identity is assigned to an existing business", async function () {
  const result = await invoke({
    enabled: "true",
    identity: {
      trustedIdentityId: "clerk-user-verified",
      provider: "clerk",
      sessionId: "session-secret",
      sessionClaims: { token: "token-secret" }
    },
    body: { businessId: " business-a " }
  });

  assert.equal(result.response.statusCode, 200);
  assert.deepEqual(result.assignmentCalls, [["clerk-user-verified", "business-a"]]);
  assert.deepEqual(result.response.body, {
    businessId: "business-a",
    ownershipAssigned: true
  });
  assert.deepEqual(Object.keys(result.response.body).sort(), ["businessId", "ownershipAssigned"]);
  assert.equal(JSON.stringify(result.response.body).includes("clerk-user-verified"), false);
  assert.equal(JSON.stringify(result.response.body).includes("secret"), false);
});
