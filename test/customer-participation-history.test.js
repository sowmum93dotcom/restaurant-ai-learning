const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const auth = require("../api/_lib/demeos-customer-authentication.js");
const persistence = require("../api/_lib/persistence.js");
const { createPersistenceRepository } = persistence;
const { SCHEMA_STATEMENTS } = require("../api/_lib/database.js");
const { DEMEOS_ACTOR_SCOPES, DEMEOS_ACTIONS, canPerformDemeosAction } = require("../api/_lib/demeos-rules.js");

function response() { return { statusCode: null, body: null, headers: {}, setHeader(n, v) { this.headers[n] = v; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; }

async function invokeHistory(identity, repository, request = {}) {
  const oldAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const oldRepo = persistence.getRepository;
  auth.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  persistence.getRepository = () => repository;
  delete require.cache[require.resolve("../api/public-config.js")];
  try {
    const res = response();
    await require("../api/public-config.js")({ method: "GET", url: "/api/customer/participation",
      query: { resource: "customer-participation", customerId: "browser-attacker", limit: "999" }, ...request }, res);
    return res;
  } finally {
    auth.resolveTrustedCustomerIdentityFromRequest = oldAuth;
    persistence.getRepository = oldRepo;
    delete require.cache[require.resolve("../api/public-config.js")];
  }
}

async function invokeParticipation(identity, repository, body = { action: "Interested" }) {
  const oldAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const oldRepo = persistence.getRepository;
  auth.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  persistence.getRepository = () => repository;
  const route = "../api/customer/work/[campaignId]/participation.js";
  delete require.cache[require.resolve(route)];
  try {
    const res = response();
    await require(route)({ method: "POST", query: { campaignId: "campaign-a", customerId: "query-attacker" },
      headers: { "x-customer-id": "header-attacker" }, body }, res);
    return res;
  } finally {
    auth.resolveTrustedCustomerIdentityFromRequest = oldAuth;
    persistence.getRepository = oldRepo;
    delete require.cache[require.resolve(route)];
  }
}

test("participation ownership migration is nullable, additive, indexed, and never backfills", function () {
  const schema = SCHEMA_STATEMENTS.join("\n");
  assert.match(schema, /trusted_customer_identity_id TEXT NULL/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS trusted_customer_identity_id TEXT NULL/);
  assert.match(schema, /trusted_customer_identity_id, participated_at DESC, participation_id DESC/);
  assert.doesNotMatch(schema, /UPDATE demeos_customer_participations|SET trusted_customer_identity_id/);
});

test("only CUSTOMER can read its own participation", function () {
  assert.equal(canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.CUSTOMER,
    action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PARTICIPATION }), true);
  for (const role of [DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER, DEMEOS_ACTOR_SCOPES.BUSINESS_OWNER, DEMEOS_ACTOR_SCOPES.ADMIN]) {
    assert.equal(canPerformDemeosAction({ actorScope: role, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PARTICIPATION }), false);
  }
});

test("Interested stays public while only a trusted CUSTOMER identity is stored", async function () {
  const received = [];
  const repository = { getOwnedBusinessIds: async (identity) => identity === "known-owner" ? ["business-a"] : [],
    recordCustomerParticipation: async (...args) => { received.push(args); return { action: "Interested" }; } };
  assert.equal((await invokeParticipation(null, repository,
    { action: "Interested", customerId: "body-attacker" })).statusCode, 201);
  assert.deepEqual(received.pop(), ["campaign-a", "Interested", null]);
  assert.equal((await invokeParticipation({ trustedCustomerIdentityId: "trusted-customer" }, repository,
    { action: "Interested", trustedCustomerIdentityId: "body-attacker" })).statusCode, 201);
  assert.deepEqual(received.pop(), ["campaign-a", "Interested", "trusted-customer"]);
  assert.equal((await invokeParticipation({ trustedCustomerIdentityId: "known-owner" }, repository)).statusCode, 201);
  assert.deepEqual(received.pop(), ["campaign-a", "Interested", null]);
});

test("history requires a customer, rejects owners, and uses only trusted ownership with limit 50", async function () {
  const repository = { getOwnedBusinessIds: async () => [], getCustomerParticipations: async (...args) => {
    assert.deepEqual(args, ["trusted-customer", 50]);
    return [{ action: "Interested", content: "Public possibility", businessName: "Cafe", participatedAt: "2026-09-14T10:00:00Z" }];
  } };
  assert.equal((await invokeHistory(null, repository)).statusCode, 401);
  assert.equal((await invokeHistory({ trustedCustomerIdentityId: "owner" }, { getOwnedBusinessIds: async () => ["business-a"] })).statusCode, 403);
  const res = await invokeHistory({ trustedCustomerIdentityId: "trusted-customer" }, repository);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.participations[0].action, "Interested");
  assert.doesNotMatch(JSON.stringify(res.body), /trusted-customer|browser-attacker|businessId|campaignId|provider|identity|score|rank/);
});

test("repository writes nullable trusted identity and reads deterministic owner-isolated history", async function () {
  const campaign = { campaignType: "social", campaignText: "Public possibility", approvalStatus: "Approved" };
  const calls = [];
  const repository = createPersistenceRepository({ ensureSchema: async () => {}, query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith("SELECT business_id")) return { rows: [{ business_id: "business-a", campaign }] };
    if (sql.startsWith("INSERT INTO")) return { rows: [{ action: "Interested" }] };
    return { rows: [{ action: "Interested", participated_at: new Date("2026-09-14T10:00:00Z"),
      campaign_id: "campaign-a", campaign, profile: { name: "Cafe", location: "York", secret: "private" } }] };
  } });
  await repository.recordCustomerParticipation("campaign-a", "Interested");
  await repository.recordCustomerParticipation("campaign-a", "Interested", "trusted-customer");
  assert.equal(calls[1].values[3], null);
  assert.equal(calls[3].values[3], "trusted-customer");
  const history = await repository.getCustomerParticipations("trusted-customer", 999);
  assert.deepEqual(calls[4].values, ["trusted-customer", 50]);
  assert.match(calls[4].sql, /WHERE p\.trusted_customer_identity_id = \$1/);
  assert.match(calls[4].sql, /ORDER BY p\.participated_at DESC, p\.participation_id DESC LIMIT \$2/);
  assert.deepEqual(history, [{ action: "Interested", participatedAt: "2026-09-14T10:00:00.000Z",
    content: "Public possibility", businessName: "Cafe", location: "York" }]);
});

test("My Participation states and rendering are truthful, separate, safe, and consolidated", function () {
  const html = fs.readFileSync(require.resolve("../my-demeos.html"), "utf8");
  const js = fs.readFileSync(require.resolve("../js/my-demeos.js"), "utf8");
  const customer = fs.readFileSync(require.resolve("../js/customer.js"), "utf8");
  const vercel = fs.readFileSync(require.resolve("../vercel.json"), "utf8");
  assert.match(html, /Sign in is required to see your participation across visits/);
  assert.match(html, /No participation recorded yet/);
  assert.match(html, /When you choose Interested on a possibility while signed in, it can appear here/);
  assert.match(html, /Interested is an interest signal only\. It is not a purchase, booking or sale/);
  assert.match(js, /action\.textContent = "Interested"/);
  assert.match(js, /content\.textContent = participation\.content/);
  assert.doesNotMatch(js, /innerHTML|localStorage|sessionStorage/);
  assert.match(vercel, /customer\/participation[^]*public-config\?resource=customer-participation/);
  assert.match(customer, /Interested is an interest signal only/);
  assert.doesNotMatch(html.slice(html.indexOf('id="my-participation"'), html.indexOf("My Preferences")), /order history|marketplace|conversion|rating|ranking/i);
});
