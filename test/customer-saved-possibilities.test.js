const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const auth = require("../api/_lib/demeos-customer-authentication.js");
const persistence = require("../api/_lib/persistence.js");
const { createPersistenceRepository } = persistence;
const { DEMEOS_ACTOR_SCOPES, DEMEOS_ACTIONS, canPerformDemeosAction } = require("../api/_lib/demeos-rules.js");

function response() { return { statusCode: null, body: null, headers: {}, setHeader(n, v) { this.headers[n] = v; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; }
async function invoke(identity, repository, req) {
  const oldAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const oldRepo = persistence.getRepository;
  auth.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  persistence.getRepository = () => repository;
  delete require.cache[require.resolve("../api/public-config.js")];
  try {
    const res = response();
    await require("../api/public-config.js")({ url: "/api/customer/possibilities/saved", query: { resource: "customer-saved-possibilities", ...(req.query || {}) }, headers: {}, ...req }, res);
    return res;
  } finally {
    auth.resolveTrustedCustomerIdentityFromRequest = oldAuth; persistence.getRepository = oldRepo;
    delete require.cache[require.resolve("../api/public-config.js")];
  }
}

test("only CUSTOMER has narrow saved-possibility actions", function () {
  for (const action of [DEMEOS_ACTIONS.RECORD_OWN_CUSTOMER_SAVED_POSSIBILITY, DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_SAVED_POSSIBILITIES, DEMEOS_ACTIONS.REMOVE_OWN_CUSTOMER_SAVED_POSSIBILITY]) {
    assert.equal(canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.CUSTOMER, action }), true);
    for (const scope of [DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER, DEMEOS_ACTOR_SCOPES.BUSINESS_OWNER, DEMEOS_ACTOR_SCOPES.ADMIN])
      assert.equal(canPerformDemeosAction({ actorScope: scope, action }), false);
  }
});

test("save accepts only workItemId and uses trusted ownership", async function () {
  let received;
  const repo = { getOwnedBusinessIds: async () => [], saveCustomerPossibility: async (...args) => {
    received = args; return { content: "Quiet supper", businessName: "Cafe", relevance: { basis: "explicit-customer-intent-overlap" }, createdAt: "2026-09-14T00:00:00Z" };
  } };
  const ok = await invoke({ trustedCustomerIdentityId: "trusted-customer" }, repo, { method: "POST", body: { workItemId: "work-1" } });
  assert.equal(ok.statusCode, 201); assert.deepEqual(received, ["trusted-customer", "work-1"]);
  assert.doesNotMatch(JSON.stringify(ok.body), /trusted-customer|work-1/);
  for (const body of [{ workItemId: "work-1", customerId: "attacker" }, { workItemId: "work-1", businessId: "attacker" }, { workItemId: "work-1", content: "fake" }])
    assert.equal((await invoke({ trustedCustomerIdentityId: "trusted-customer" }, repo, { method: "POST", body })).statusCode, 400);
});

test("anonymous, owner and invalid public work cannot save", async function () {
  const repo = { getOwnedBusinessIds: async () => ["owned"] };
  assert.equal((await invoke(null, repo, { method: "POST", body: { workItemId: "work-1" } })).statusCode, 401);
  assert.equal((await invoke({ trustedCustomerIdentityId: "owner" }, repo, { method: "POST", body: { workItemId: "work-1" } })).statusCode, 403);
  const customerRepo = { getOwnedBusinessIds: async () => [], saveCustomerPossibility: async () => null };
  assert.equal((await invoke({ trustedCustomerIdentityId: "customer" }, customerRepo, { method: "POST", body: { workItemId: "unpublished" } })).statusCode, 404);
});

test("GET is owner-isolated, fixed at 50, and minimized", async function () {
  let args;
  const repo = { getOwnedBusinessIds: async () => [], getCustomerSavedPossibilities: async (...values) => { args = values; return [{ content: "A possibility", businessName: "Cafe", relevance: { basis: "explicit-customer-intent-overlap" }, createdAt: "2026-09-14T00:00:00Z" }]; } };
  const res = await invoke({ trustedCustomerIdentityId: "customer-b" }, repo, { method: "GET", query: { customerId: "customer-a", limit: "999" } });
  assert.deepEqual(args, ["customer-b", 50]);
  assert.doesNotMatch(JSON.stringify(res.body), /customer-b|customer-a|businessId|campaignId|workItemId|score|ranking/);
});

test("repository resolves authoritative publishable work and idempotently snapshots it", async function () {
  const calls = [];
  const campaign = { approvalStatus: "Approved", campaignType: "social", campaignText: "A quiet supper" };
  const db = { ensureSchema: async () => {}, query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("FROM demeos_campaigns c JOIN")) return { rows: [{ campaign_id: "work-1", campaign, profile: { name: "Cafe", location: "York" } }] };
    return { rows: [{ possibility_content: "A quiet supper", business_name: "Cafe", location: "York", relevance_basis: "explicit-customer-intent-overlap", created_at: new Date("2026-09-14T00:00:00Z") }] };
  } };
  const result = await createPersistenceRepository(db).saveCustomerPossibility("trusted", "work-1");
  assert.equal(result.content, "A quiet supper");
  assert.match(calls[0].sql, /JOIN demeos_customer_possibility_issuances i/);
  assert.match(calls[0].sql, /i\.trusted_customer_identity_id = \$2 AND i\.campaign_snapshot = c\.campaign/);
  assert.deepEqual(calls[0].values, ["work-1", "trusted"]);
  assert.match(calls[1].sql, /ON CONFLICT \(trusted_customer_identity_id, work_item_id\)/);
  assert.match(calls[1].sql, /demeos_customer_possibility_issuances/);
  assert.deepEqual(calls[1].values.slice(0, 5), ["trusted", "work-1", "A quiet supper", "Cafe", "York"]);
});

test("issuance records the trusted customer and exact authoritative campaign without creating customer signals", async function () {
  const calls = [];
  const campaign = { approvalStatus: "Approved", campaignType: "social", campaignText: "A quiet supper" };
  const db = { ensureSchema: async () => {}, query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith("SELECT")) return { rows: [{ campaign_id: "work-1", campaign, profile: { name: "Cafe" } }] };
    return { rows: [{ work_item_id: "work-1" }] };
  } };
  const issued = await createPersistenceRepository(db).recordCustomerPossibilityIssuance("customer-a", [{
    workItemId: "work-1", content: "A quiet supper", businessName: "Cafe"
  }]);
  assert.deepEqual(issued, ["work-1"]);
  assert.deepEqual(calls[1].values, ["customer-a", "work-1", JSON.stringify(campaign)]);
  assert.match(calls[1].sql, /'demeos-possibility-issuance', 'demeos'/);
  assert.doesNotMatch(calls[1].sql, /participations|feedback|preferences|purchase|booking|sale|conversion|outcome|success/i);
});

test("issuance refuses a possibility that no longer exactly matches authoritative work", async function () {
  let inserts = 0;
  const db = { ensureSchema: async () => {}, query: async (sql) => {
    if (sql.startsWith("SELECT")) return { rows: [{ campaign_id: "work-1",
      campaign: { approvalStatus: "Approved", campaignType: "social", campaignText: "Changed content" },
      profile: { name: "Cafe" } }] };
    inserts += 1; return { rows: [{ work_item_id: "work-1" }] };
  } };
  assert.deepEqual(await createPersistenceRepository(db).recordCustomerPossibilityIssuance("customer-a", [{
    workItemId: "work-1", content: "Old content", businessName: "Cafe"
  }]), []);
  assert.equal(inserts, 0);
});

test("save UX is explicit, distinct, safe, and consolidated into an existing function", function () {
  const customer = fs.readFileSync(require.resolve("../js/customer.js"), "utf8");
  const myDemeos = fs.readFileSync(require.resolve("../js/my-demeos.js"), "utf8");
  const html = fs.readFileSync(require.resolve("../my-demeos.html"), "utf8");
  assert.match(customer, /Save to My DEMEOS/); assert.match(customer, /Saved to My Possibilities\./);
  assert.match(customer, /saveButton\.addEventListener\("click"/);
  assert.match(customer, /authenticated === true/); assert.match(customer, /Enter My DEMEOS if you want to keep this possibility across visits/);
  assert.match(fs.readFileSync(require.resolve("../customer.html"), "utf8"), /Enter My DEMEOS if you want to keep this intention across visits/);
  assert.match(customer, /Interested is an interest signal only/); assert.match(customer, /customer-feedback/);
  assert.doesNotMatch(customer.slice(customer.indexOf("function showFocused"), customer.indexOf("valid.forEach")), /saveCustomerPossibility\(possibility\)(?!;\n)/);
  assert.match(myDemeos, /\.textContent = possibility\.content/); assert.doesNotMatch(myDemeos, /innerHTML/);
  assert.match(html, /No saved possibilities yet/); assert.match(html, /When DEMEOS shows you a possibility, you can choose to save it here/);
  const vercel = fs.readFileSync(require.resolve("../vercel.json"), "utf8");
  assert.match(vercel, /customer\/possibilities\/saved[^]*public-config\?resource=customer-saved-possibilities/);
  assert.equal(fs.existsSync(require.resolve("../api/public-config.js")), true);
});
test("saved possibility removal requires authentication and uses only trusted ownership", async function () {
  assert.equal((await invoke(null, {}, { method: "DELETE", body: { savedPossibilityId: "9" } })).statusCode, 401);
  let received;
  const repo = { getOwnedBusinessIds: async () => [], removeCustomerSavedPossibility: async (...args) => { received = args; return args[0] === "customer-a"; } };
  assert.equal((await invoke({ trustedCustomerIdentityId: "customer-a" }, repo, { method: "DELETE", query: { customerId: "attacker" }, body: { savedPossibilityId: "9" } })).statusCode, 200);
  assert.deepEqual(received, ["customer-a", "9"]);
  assert.equal((await invoke({ trustedCustomerIdentityId: "customer-b" }, { getOwnedBusinessIds: async () => [], removeCustomerSavedPossibility: async () => false }, { method: "DELETE", body: { savedPossibilityId: "9" } })).statusCode, 404);
  assert.equal((await invoke({ trustedCustomerIdentityId: "customer-a" }, repo, { method: "DELETE", body: { savedPossibilityId: "9", customerId: "attacker" } })).statusCode, 400);
});
test("saved possibility removal deletes only its owned relationship row", async function () {
  const calls = []; const db = { ensureSchema: async () => {}, query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ saved_possibility_id: 9 }] }; } };
  assert.equal(await createPersistenceRepository(db).removeCustomerSavedPossibility("customer-a", "9"), true);
  assert.match(calls[0].sql, /DELETE FROM demeos_customer_saved_possibilities/);
  assert.match(calls[0].sql, /trusted_customer_identity_id = \$1 AND saved_possibility_id = \$2/);
  assert.doesNotMatch(calls[0].sql, /demeos_campaigns|participations|feedback/);
});
