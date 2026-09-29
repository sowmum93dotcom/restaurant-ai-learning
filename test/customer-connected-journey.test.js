const assert = require("node:assert/strict");
const test = require("node:test");
const { buildCustomerUnderstanding, confirmCustomerUnderstanding } = require("../js/customer-understanding.js");
const auth = require("../api/_lib/demeos-customer-authentication.js");
const persistence = require("../api/_lib/persistence.js");
const issuance = require("../api/_lib/customer-possibility-issuance-trust.js");

function response() {
  return { statusCode: null, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
}
async function invoke(path, identity, repository, method, body) {
  const originalAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const originalRepo = persistence.getRepository;
  const originalPrepare = issuance.prepareCustomerPossibilityIssuanceTrust;
  const originalConfirm = issuance.confirmCustomerPossibilityIssuanceDelivery;
  auth.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  persistence.getRepository = () => repository;
  issuance.prepareCustomerPossibilityIssuanceTrust = async () => {};
  issuance.confirmCustomerPossibilityIssuanceDelivery = async (_identity, ids) => ids;
  const modulePath = require.resolve(path);
  delete require.cache[modulePath];
  const res = response();
  try {
    const handler = require(modulePath);
    const req = path.endsWith("public-config.js")
      ? { method, body, url: "/api/customer/possibilities/saved",
        query: { resource: "customer-saved-possibilities" }, headers: {} }
      : { method, body, headers: {} };
    await handler(req, res);
    return res;
  } finally {
    auth.resolveTrustedCustomerIdentityFromRequest = originalAuth;
    persistence.getRepository = originalRepo;
    issuance.prepareCustomerPossibilityIssuanceTrust = originalPrepare;
    issuance.confirmCustomerPossibilityIssuanceDelivery = originalConfirm;
    delete require.cache[modulePath];
  }
}
test("confirmed public possibility requires trusted identity before save and remains owner-isolated on retrieval", async () => {
  const understanding = confirmCustomerUnderstanding(buildCustomerUnderstanding("Spend time together", "relaxed family dinner"));
  const saved = new Map();
  const repository = {
    async getCustomerWork() { return [{ workItemId: "work-family", businessName: "Example cafe",
      content: "A relaxed family dinner", participationAction: "Interested" }]; },
    async getOwnedBusinessIds() { return []; },
    async saveCustomerPossibility(identity, id) {
      if (id !== "work-family") return null;
      const item = { content: "A relaxed family dinner", businessName: "Example cafe",
        relevance: { basis: "explicit-customer-intent-overlap" }, createdAt: "2026-09-29T12:00:00Z" };
      saved.set(identity, item); return item;
    },
    async getCustomerSavedPossibilities(identity) { return saved.has(identity) ? [saved.get(identity)] : []; }
  };
  const found = await invoke("../api/customer/possibilities.js", null, repository, "POST", { understanding });
  assert.equal(found.statusCode, 200);
  assert.equal(found.body.possibilities.length, 1);
  const id = found.body.possibilities[0].workItemId;
  assert.equal(id, "work-family");
  const anonymous = await invoke("../api/public-config.js", null, repository, "POST", { workItemId: id });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(saved.size, 0);
  const owner = { trustedCustomerIdentityId: "customer-one" };
  const created = await invoke("../api/public-config.js", owner, repository, "POST", { workItemId: id });
  assert.equal(created.statusCode, 201);
  assert.equal(saved.size, 1);
  const mine = await invoke("../api/public-config.js", owner, repository, "GET");
  assert.equal(mine.statusCode, 200);
  assert.match(JSON.stringify(mine.body), /A relaxed family dinner/);
  const other = await invoke("../api/public-config.js", { trustedCustomerIdentityId: "customer-two" }, repository, "GET");
  assert.equal(other.statusCode, 200);
  assert.doesNotMatch(JSON.stringify(other.body), /A relaxed family dinner/);
  assert.doesNotMatch(JSON.stringify(mine.body), /customer-one|work-family/);
});
