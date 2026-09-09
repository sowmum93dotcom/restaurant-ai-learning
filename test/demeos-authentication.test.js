const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveTrustedIdentityFromRequest
} = require("../api/_lib/demeos-authentication.js");

const request = {
  method: "GET",
  url: "/api/test",
  headers: { host: "demeos.test" }
};
const configuredEnvironment = {
  CLERK_SECRET_KEY: "sk_test_server_only",
  CLERK_PUBLISHABLE_KEY: "pk_test_public"
};

async function withClerkEnvironment(environment, callback) {
  const previous = {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY
  };

  for (const name of Object.keys(previous)) {
    if (environment[name] === undefined) delete process.env[name];
    else process.env[name] = environment[name];
  }

  try {
    return await callback();
  } finally {
    for (const name of Object.keys(previous)) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

function verifiedAs(userId, extraAuthentication = {}) {
  return async function authenticateRequest() {
    return {
      isAuthenticated: true,
      toAuth() {
        return { userId, ...extraAuthentication };
      }
    };
  };
}

function resolve(req, authenticateRequest) {
  return withClerkEnvironment(configuredEnvironment, function () {
    return resolveTrustedIdentityFromRequest(req, { authenticateRequest });
  });
}

test("verified Clerk user ID becomes the exact immutable trusted identity", async function () {
  const identity = await resolve(request, verifiedAs("user_ClerkExactCase"));

  assert.deepEqual(identity, {
    trustedIdentityId: "user_ClerkExactCase",
    provider: "clerk"
  });
  assert.equal(Object.isFrozen(identity), true);
  assert.throws(function () {
    Object.defineProperty(identity, "trustedIdentityId", { value: "replacement" });
  });
});

test("Node-style Vercel requests are converted to the Web Request Clerk requires", async function () {
  let received;
  const identity = await resolve({
    method: "POST",
    url: "/api/businesses/business-a",
    headers: {
      host: "demeos.test",
      authorization: "Bearer verified-session-token",
      cookie: "__session=verified-session-token"
    }
  }, async function authenticateRequest(clerkRequest) {
    received = clerkRequest;
    return {
      isAuthenticated: true,
      toAuth() { return { userId: "user_1" }; }
    };
  });

  assert.equal(identity.trustedIdentityId, "user_1");
  assert.equal(received instanceof Request, true);
  assert.equal(received.method, "POST");
  assert.equal(received.url, "https://demeos.test/api/businesses/business-a");
  assert.equal(received.headers.get("authorization"), "Bearer verified-session-token");
  assert.equal(received.headers.get("cookie"), "__session=verified-session-token");
});

test("successful result exposes only identity and provider, not Clerk session details", async function () {
  const identity = await resolve(request, verifiedAs("user_1", {
    sessionId: "sess_secret",
    sessionClaims: { token: "secret" },
    tokenType: "session_token"
  }));

  assert.deepEqual(Object.keys(identity).sort(), ["provider", "trustedIdentityId"]);
  assert.equal(JSON.stringify(identity).includes("secret"), false);
});

test("unauthenticated Clerk result returns null", async function () {
  const identity = await resolve(request, async function () {
    return { isAuthenticated: false, toAuth: () => ({ userId: "unverified" }) };
  });
  assert.equal(identity, null);
});

test("failed authentication result returns null", async function () {
  assert.equal(await resolve(request, async () => null), null);
  assert.equal(await resolve(request, async () => ({ status: "handshake" })), null);
});

test("missing Clerk configuration fails closed before authentication", async function () {
  let calls = 0;
  const authenticateRequest = async function () {
    calls += 1;
    return verifiedAs("user_1")();
  };

  const identity = await withClerkEnvironment({}, function () {
    return resolveTrustedIdentityFromRequest(request, { authenticateRequest });
  });
  assert.equal(identity, null);
  assert.equal(calls, 0);
});

test("Clerk authentication exceptions fail closed", async function () {
  const identity = await resolve(request, async function () {
    throw new Error("Clerk unavailable");
  });
  assert.equal(identity, null);
});

test("client-controlled identity fields cannot create trusted identity", async function () {
  const unauthenticated = async () => ({ isAuthenticated: false });
  const clientRequests = [
    { ...request, body: { trustedIdentityId: "body-user" } },
    { ...request, query: { trustedIdentityId: "query-user" } },
    { ...request, headers: { host: "demeos.test", "x-user-id": "header-user", "x-identity-id": "header-identity" } },
    { ...request, businessId: "business-as-user" },
    { ...request, actorScope: "demeos-admin" },
    { ...request, localStorage: { trustedIdentityId: "browser-user" } },
    { ...request, browser: { userId: "browser-user" } }
  ];

  for (const clientRequest of clientRequests) {
    assert.equal(await resolve(clientRequest, unauthenticated), null);
  }
});

test("malformed requests cannot authenticate", async function () {
  let calls = 0;
  const authenticateRequest = async function () {
    calls += 1;
    return verifiedAs("user_1")();
  };

  for (const malformedRequest of [null, undefined, "request", {}, { headers: null }, { headers: {} }]) {
    assert.equal(await resolve(malformedRequest, authenticateRequest), null);
  }
  assert.equal(calls, 0);
});

test("raw bearer token and unverified JWT payload are never identity evidence", async function () {
  const bearerValue = "attacker-selected-bearer-identity";
  const unverifiedUserId = "attacker-selected-jwt-subject";
  const attackerRequest = {
    method: "GET",
    url: "/api/test",
    headers: { host: "demeos.test", authorization: `Bearer ${bearerValue}` },
    jwt: { payload: { sub: unverifiedUserId, userId: unverifiedUserId } }
  };

  const identity = await resolve(attackerRequest, async () => ({ isAuthenticated: false }));
  assert.equal(identity, null);
  assert.notEqual(identity, bearerValue);
  assert.notEqual(identity, unverifiedUserId);
});
