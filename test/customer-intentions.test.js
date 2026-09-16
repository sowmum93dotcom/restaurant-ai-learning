const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const auth = require("../api/_lib/demeos-customer-authentication.js");
const persistence = require("../api/_lib/persistence.js");
const { validateCustomerIntention } = require("../api/_lib/customer-intention-contract.js");
const { DEMEOS_ACTOR_SCOPES, DEMEOS_ACTIONS, canPerformDemeosAction } = require("../api/_lib/demeos-rules.js");

function response() { return { statusCode: null, body: null, headers: {}, setHeader(n, v) { this.headers[n] = v; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; }
async function invoke(identity, repository, req) {
  const oldAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const oldRepo = persistence.getRepository;
  auth.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  persistence.getRepository = () => repository;
  delete require.cache[require.resolve("../api/public-config.js")];
  try { const res = response(); await require("../api/public-config.js")({ url: "/api/customer/intentions", query: { resource: "customer-intentions" }, headers: {}, ...req }, res); return res; }
  finally { auth.resolveTrustedCustomerIdentityFromRequest = oldAuth; persistence.getRepository = oldRepo; delete require.cache[require.resolve("../api/public-config.js")]; }
}

const valid = { intention: "Eat & enjoy", customerText: "A quiet supper", understanding: "You’d like to eat and enjoy a quiet supper." };
test("intention contract accepts only bounded confirmed evidence fields", function () {
  assert.equal(validateCustomerIntention(valid).evidenceType, "customer-confirmed-intention");
  assert.equal(validateCustomerIntention({ ...valid, customerId: "spoof" }), null);
  assert.equal(validateCustomerIntention({ ...valid, understanding: "<b>claim</b>" }), null);
  assert.equal(validateCustomerIntention({ ...valid, customerText: "x".repeat(501) }), null);
});
test("only CUSTOMER receives the two own-intention actions", function () {
  for (const action of [DEMEOS_ACTIONS.RECORD_OWN_CUSTOMER_INTENTION, DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_INTENTIONS, DEMEOS_ACTIONS.REMOVE_OWN_CUSTOMER_INTENTION]) {
    assert.equal(canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.CUSTOMER, action }), true);
    for (const role of [DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER, DEMEOS_ACTOR_SCOPES.BUSINESS_OWNER, DEMEOS_ACTOR_SCOPES.ADMIN]) assert.equal(canPerformDemeosAction({ actorScope: role, action }), false);
  }
});
test("authenticated save uses only trusted identity and returns minimized evidence", async function () {
  let owner;
  const repo = { getOwnedBusinessIds: async () => [], saveCustomerIntention: async (id, value) => { owner = id; return { intention: value.intention, understanding: value.understanding, createdAt: "2026-09-14T00:00:00Z" }; } };
  const res = await invoke({ trustedCustomerIdentityId: "trusted-A", provider: "clerk" }, repo, { method: "POST", body: valid });
  assert.equal(res.statusCode, 201); assert.equal(owner, "trusted-A");
  assert.deepEqual(Object.keys(res.body.intention), ["intention", "understanding", "createdAt"]);
  assert.equal(JSON.stringify(res.body).includes("trusted-A"), false);
});
test("unauthenticated and business-owner saves are rejected", async function () {
  const repo = { getOwnedBusinessIds: async () => ["business-1"] };
  assert.equal((await invoke(null, repo, { method: "POST", body: valid })).statusCode, 401);
  assert.equal((await invoke({ trustedCustomerIdentityId: "owner" }, repo, { method: "POST", body: valid })).statusCode, 403);
});
test("trusted provider admin role cannot become a customer", async function () {
  const customerAuth = require("../api/_lib/demeos-customer-authentication.js");
  assert.equal(await customerAuth.resolveTrustedCustomerIdentityFromRequest({}, {
    resolveTrustedIdentityFromRequest: async () => ({ trustedIdentityId: "admin", actorScope: "demeos-admin" })
  }), null);
});
test("GET is isolated by trusted identity, bounded and leaks no identity", async function () {
  let args;
  const repo = { getOwnedBusinessIds: async () => [], getCustomerIntentions: async (...given) => { args = given; return [{ intention: "Go somewhere", understanding: "Confirmed", createdAt: "2026-09-14T00:00:00Z" }]; } };
  const res = await invoke({ trustedCustomerIdentityId: "customer-B" }, repo, { method: "GET", query: { resource: "customer-intentions", customerId: "customer-A", limit: "999" } });
  assert.deepEqual(args, ["customer-B", 50]); assert.equal(JSON.stringify(res.body).includes("customer-B"), false);
});
test("UI saves only from the explicit post-confirmation click and preserves anonymous flow", function () {
  const customer = fs.readFileSync(require.resolve("../js/customer.js"), "utf8");
  const html = fs.readFileSync(require.resolve("../my-demeos.html"), "utf8");
  assert.match(customer, /saveButton\.onclick = async function/);
  assert.doesNotMatch(customer.slice(customer.indexOf('customer-understanding-confirm'), customer.indexOf('saveButton.onclick')), /method: "POST"/);
  assert.match(html, /No saved intentions yet/); assert.match(html, /When you confirm an intention, you can choose to save it here/);
  assert.match(fs.readFileSync(require.resolve("../vercel.json"), "utf8"), /customer\/intentions[^]*public-config\?resource=customer-intentions/);
});
test("removal requires authentication, trusts server identity, and rejects non-owned intentions", async function () {
  assert.equal((await invoke(null, {}, { method: "DELETE", body: { intentionId: "7" } })).statusCode, 401);
  let received;
  const repo = { getOwnedBusinessIds: async () => [], removeCustomerIntention: async (...args) => { received = args; return args[0] === "customer-a" && args[1] === "7"; } };
  const removed = await invoke({ trustedCustomerIdentityId: "customer-a" }, repo, { method: "DELETE", query: { customerId: "customer-b" }, body: { intentionId: "7" } });
  assert.equal(removed.statusCode, 200); assert.deepEqual(received, ["customer-a", "7"]);
  assert.equal((await invoke({ trustedCustomerIdentityId: "customer-b" }, { getOwnedBusinessIds: async () => [], removeCustomerIntention: async () => false }, { method: "DELETE", body: { intentionId: "7" } })).statusCode, 404);
  assert.equal((await invoke({ trustedCustomerIdentityId: "customer-a" }, repo, { method: "DELETE", body: { intentionId: "7", customerId: "customer-b" } })).statusCode, 400);
});
test("intention removal is owner-scoped and does not touch other evidence", async function () {
  const calls = []; const db = { ensureSchema: async () => {}, query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ intention_id: 7 }] }; } };
  assert.equal(await persistence.createPersistenceRepository(db).removeCustomerIntention("customer-a", "7"), true);
  assert.match(calls[0].sql, /DELETE FROM demeos_customer_intentions/);
  assert.match(calls[0].sql, /trusted_customer_identity_id = \$1 AND intention_id = \$2/);
  assert.doesNotMatch(calls[0].sql, /participations|feedback|preferences|saved_possibilities|campaigns/);
});
