const assert = require("node:assert/strict");
const test = require("node:test");
const auth = require("../api/_lib/demeos-customer-authentication.js");
const persistence = require("../api/_lib/persistence.js");

function response() {
  return { statusCode: null, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

async function request(identity, repository, method, body = {}) {
  const oldAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const oldRepository = persistence.getRepository;
  auth.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  persistence.getRepository = () => repository;
  const route = require.resolve("../api/public-config.js");
  delete require.cache[route];
  try {
    const res = response();
    await require(route)({ method, url: "/api/customer/privacy-controls",
      query: { resource: "customer-privacy-controls" }, body }, res);
    return res;
  } finally {
    auth.resolveTrustedCustomerIdentityFromRequest = oldAuth;
    persistence.getRepository = oldRepository;
    delete require.cache[route];
  }
}

test("privacy controls default safely and persist only against trusted customer identity", async function () {
  const owners = [];
  const repository = { getOwnedBusinessIds: async () => [],
    getCustomerPrivacyControls: async (owner) => { owners.push(owner); return { usePreferencesAsGuidance: false, useFeedbackAsGuidance: false }; },
    saveCustomerPrivacyControls: async (owner, controls) => { owners.push(owner); return controls; } };
  const read = await request({ trustedCustomerIdentityId: "customer-a" }, repository, "GET");
  assert.deepEqual(read.body.controls, { usePreferencesAsGuidance: false, useFeedbackAsGuidance: false });
  const saved = await request({ trustedCustomerIdentityId: "customer-a" }, repository, "POST",
    { usePreferencesAsGuidance: true, useFeedbackAsGuidance: true, customerId: "customer-b" });
  assert.equal(saved.statusCode, 400);
  const valid = await request({ trustedCustomerIdentityId: "customer-a" }, repository, "POST",
    { usePreferencesAsGuidance: true, useFeedbackAsGuidance: true });
  assert.equal(valid.statusCode, 200);
  assert.deepEqual(owners, ["customer-a", "customer-a"]);
});

test("business owners and anonymous visitors cannot obtain or change customer controls", async function () {
  let accesses = 0;
  const repository = { getOwnedBusinessIds: async () => ["business-a"],
    getCustomerPrivacyControls: async () => { accesses += 1; }, saveCustomerPrivacyControls: async () => { accesses += 1; } };
  assert.equal((await request({ trustedCustomerIdentityId: "owner-a" }, repository, "GET")).statusCode, 403);
  assert.equal((await request({ trustedCustomerIdentityId: "owner-a" }, repository, "POST",
    { usePreferencesAsGuidance: true, useFeedbackAsGuidance: true })).statusCode, 403);
  assert.equal((await request(null, repository, "GET")).statusCode, 401);
  assert.equal(accesses, 0);
});

test("privacy persistence is separate, safely defaulted, and never changes historical evidence", async function () {
  const queries = [];
  const database = { ensureSchema: async () => {}, async query(statement, values) {
    queries.push({ statement, values });
    if (statement.startsWith("SELECT")) return { rows: [] };
    return { rows: [{ use_preferences_as_guidance: true, use_feedback_as_guidance: false }] };
  } };
  const repository = persistence.createPersistenceRepository(database);
  assert.deepEqual(await repository.getCustomerPrivacyControls("customer-a"),
    { usePreferencesAsGuidance: false, useFeedbackAsGuidance: false });
  assert.deepEqual(await repository.saveCustomerPrivacyControls("customer-a",
    { usePreferencesAsGuidance: true, useFeedbackAsGuidance: false }),
  { usePreferencesAsGuidance: true, useFeedbackAsGuidance: false });
  assert.deepEqual(queries[1].values, ["customer-a", true, false]);
  assert.doesNotMatch(queries.map((item) => item.statement).join(" "),
    /DELETE FROM demeos_customer_(?:preferences|feedback|participations|intentions|saved_possibilities)/i);
});
