const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const auth = require("../api/_lib/demeos-customer-authentication.js");
const persistence = require("../api/_lib/persistence.js");
const { createPersistenceRepository } = persistence;
const { validateCustomerPreference } = require("../api/_lib/customer-preference-contract.js");
const { DEMEOS_ACTOR_SCOPES, DEMEOS_ACTIONS, canPerformDemeosAction } = require("../api/_lib/demeos-rules.js");

function response() { return { statusCode: null, body: null, headers: {}, setHeader(n, v) { this.headers[n] = v; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; }
async function invoke(identity, repository, req) {
  const oldAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const oldRepo = persistence.getRepository;
  auth.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  persistence.getRepository = () => repository;
  delete require.cache[require.resolve("../api/public-config.js")];
  try { const res = response(); await require("../api/public-config.js")({ url: "/api/customer/preferences", query: { resource: "customer-preferences", ...(req.query || {}) }, headers: {}, ...req }, res); return res; }
  finally { auth.resolveTrustedCustomerIdentityFromRequest = oldAuth; persistence.getRepository = oldRepo; delete require.cache[require.resolve("../api/public-config.js")]; }
}

const valid = { preference: "Quiet tables near a window" };
test("preference evidence requires one explicit customer-entered value", function () {
  assert.deepEqual(validateCustomerPreference(valid), { preference: valid.preference, evidenceType: "customer-explicit-preference", source: "authenticated-customer", confirmationState: "confirmed" });
  for (const body of [{}, { preference: "" }, { preference: "Tea", customerId: "customer-b" }, { preference: "<b>Tea</b>" }]) assert.equal(validateCustomerPreference(body), null);
});
test("only CUSTOMER receives create, read and remove preference actions", function () {
  for (const action of [DEMEOS_ACTIONS.RECORD_OWN_CUSTOMER_PREFERENCE, DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PREFERENCES, DEMEOS_ACTIONS.REMOVE_OWN_CUSTOMER_PREFERENCE]) {
    assert.equal(canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.CUSTOMER, action }), true);
    for (const scope of [DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER, DEMEOS_ACTOR_SCOPES.BUSINESS_OWNER, DEMEOS_ACTOR_SCOPES.ADMIN]) assert.equal(canPerformDemeosAction({ actorScope: scope, action }), false);
  }
});
test("authentication is required and a business owner is rejected", async function () {
  assert.equal((await invoke(null, {}, { method: "GET" })).statusCode, 401);
  assert.equal((await invoke({ trustedCustomerIdentityId: "owner" }, { getOwnedBusinessIds: async () => ["business"] }, { method: "GET" })).statusCode, 403);
});
test("explicit creation uses trusted identity and browser identity cannot override it", async function () {
  let args;
  const repo = { getOwnedBusinessIds: async () => [], saveCustomerPreference: async (...received) => { args = received; return { preferenceId: "1", preference: valid.preference, createdAt: "2026-09-16T00:00:00Z" }; } };
  const saved = await invoke({ trustedCustomerIdentityId: "trusted-a" }, repo, { method: "POST", body: valid });
  assert.equal(saved.statusCode, 201); assert.equal(args[0], "trusted-a"); assert.equal(args[1].evidenceType, "customer-explicit-preference");
  assert.equal((await invoke({ trustedCustomerIdentityId: "trusted-a" }, repo, { method: "POST", body: { ...valid, customerId: "customer-b" } })).statusCode, 400);
});
test("read and removal are scoped exclusively to trusted owner", async function () {
  let readArgs; let removeArgs;
  const repo = { getOwnedBusinessIds: async () => [], getCustomerPreferences: async (...args) => { readArgs = args; return [{ preferenceId: "7", preference: "Tea", createdAt: "2026-09-16T00:00:00Z" }]; }, removeCustomerPreference: async (...args) => { removeArgs = args; return args[0] === "customer-a"; } };
  const read = await invoke({ trustedCustomerIdentityId: "customer-a" }, repo, { method: "GET", query: { customerId: "customer-b", limit: "999" } });
  assert.deepEqual(readArgs, ["customer-a", 50]); assert.doesNotMatch(JSON.stringify(read.body), /customer-a|customer-b/);
  assert.equal((await invoke({ trustedCustomerIdentityId: "customer-a" }, repo, { method: "DELETE", body: { preferenceId: "7" } })).statusCode, 200);
  assert.deepEqual(removeArgs, ["customer-a", "7"]);
});
test("cross-customer removal has no match and is rejected", async function () {
  const repo = { getOwnedBusinessIds: async () => [], removeCustomerPreference: async () => false };
  assert.equal((await invoke({ trustedCustomerIdentityId: "customer-b" }, repo, { method: "DELETE", body: { preferenceId: "7" } })).statusCode, 404);
});
test("repository SQL binds owner to reads and deletes and keeps preferences separate", async function () {
  const calls = []; const db = { ensureSchema: async () => {}, query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } };
  const repo = createPersistenceRepository(db);
  await repo.getCustomerPreferences("customer-a", 50); await repo.removeCustomerPreference("customer-a", "7");
  assert.match(calls[0].sql, /WHERE trusted_customer_identity_id = \$1/); assert.match(calls[1].sql, /trusted_customer_identity_id = \$1 AND preference_id = \$2/);
  const schema = fs.readFileSync(require.resolve("../api/_lib/database.js"), "utf8");
  assert.match(schema, /customer-explicit-preference/); assert.doesNotMatch(schema.slice(schema.indexOf("demeos_customer_preferences")), /demeos_customer_(?:intentions|feedback|participations).*INSERT/);
});
test("preferences are created only by the explicit form submission", function () {
  const js = fs.readFileSync(require.resolve("../js/my-demeos.js"), "utf8");
  const html = fs.readFileSync(require.resolve("../my-demeos.html"), "utf8");
  assert.match(html, /Add a preference/); assert.match(html, /Preferences are only saved when you explicitly choose them\./);
  assert.match(js, /form\.addEventListener\("submit"/); assert.equal((js.match(/method: "POST"[^]*?\/api\/customer\/preferences/g) || []).length, 0);
  assert.doesNotMatch(fs.readFileSync(require.resolve("../js/customer.js"), "utf8"), /customer\/preferences/);
  assert.match(fs.readFileSync(require.resolve("../vercel.json"), "utf8"), /public-config\?resource=customer-preferences/);
});
