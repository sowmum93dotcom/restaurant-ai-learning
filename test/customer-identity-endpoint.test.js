const assert = require("node:assert/strict");
const test = require("node:test");

const customerAuthentication = require("../api/_lib/demeos-customer-authentication.js");

function response() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function invoke(identity, request = {}) {
  const original = customerAuthentication.resolveTrustedCustomerIdentityFromRequest;
  customerAuthentication.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  delete require.cache[require.resolve("../api/public-config.js")];
  try {
    const handler = require("../api/public-config.js");
    const res = response();
    await handler({ url: "/api/customer/identity", headers: {}, ...request }, res);
    return res;
  } finally {
    customerAuthentication.resolveTrustedCustomerIdentityFromRequest = original;
    delete require.cache[require.resolve("../api/public-config.js")];
  }
}

test("identity endpoint reports only authenticated true for a verified customer", async function () {
  const res = await invoke({ trustedCustomerIdentityId: "provider-secret-id", provider: "clerk" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { authenticated: true });
  assert.equal(JSON.stringify(res.body).includes("provider-secret-id"), false);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("identity endpoint reports explicit signed-out state and ignores supplied IDs", async function () {
  const res = await invoke(null, {
    query: { customerId: "attacker", trustedCustomerIdentityId: "attacker" },
    body: { customerId: "attacker" }
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { authenticated: false });
});

test("customer identity route is consolidated into an existing Vercel function", function () {
  const vercel = require("../vercel.json");
  assert.deepEqual(vercel.rewrites[0], {
    source: "/api/customer/identity",
    destination: "/api/public-config?resource=customer-identity"
  });
});
