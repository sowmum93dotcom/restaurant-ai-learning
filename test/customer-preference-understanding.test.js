const assert = require("node:assert/strict");
const test = require("node:test");
const auth = require("../api/_lib/demeos-customer-authentication.js");
const persistence = require("../api/_lib/persistence.js");

function response() { return { statusCode: null, body: null, headers: {}, setHeader(n, v) { this.headers[n] = v; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; }
async function invoke(identity, repository, body) {
  const oldAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const oldRepo = persistence.getRepository;
  auth.resolveTrustedCustomerIdentityFromRequest = async () => identity;
  const effectiveRepository = new Proxy(repository, {
    get(target, property) {
      if (property === "getOwnedBusinessIds" && !(property in target)) return async () => [];
      return target[property];
    }
  });
  persistence.getRepository = () => effectiveRepository;
  delete require.cache[require.resolve("../api/public-config.js")];
  try {
    const res = response();
    await require("../api/public-config.js")({ method: "POST", url: "/api/customer/understanding", query: { resource: "customer-understanding" }, body }, res);
    return res;
  } finally {
    auth.resolveTrustedCustomerIdentityFromRequest = oldAuth;
    persistence.getRepository = oldRepo;
    delete require.cache[require.resolve("../api/public-config.js")];
  }
}

const intention = { intention: "Eat & enjoy", customerText: "A lively dinner tonight", clarificationText: "" };

test("authenticated explicit preferences inform understanding as separate guidance", async function () {
  let owner;
  const res = await invoke({ trustedCustomerIdentityId: "customer-a" }, {
    getCustomerPreferences: async (identity) => { owner = identity; return [{ preference: "Quiet tables" }]; }
  }, intention);
  assert.equal(owner, "customer-a");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.understanding.preferenceContext, { evidence: [{ value: "Quiet tables", evidenceType: "customer-explicit-preference", source: "authenticated-customer", role: "guidance-not-requirement" }], authority: "current-intention-primary" });
});

test("trusted server identity scopes preferences and browser identity cannot select another customer", async function () {
  const owners = [];
  const repository = { getCustomerPreferences: async (owner) => { owners.push(owner); return [{ preference: owner === "customer-a" ? "A preference" : "B private preference" }]; } };
  const a = await invoke({ trustedCustomerIdentityId: "customer-a" }, repository, intention);
  assert.deepEqual(owners, ["customer-a"]);
  assert.doesNotMatch(JSON.stringify(a.body), /B private preference/);
  const attack = await invoke({ trustedCustomerIdentityId: "customer-a" }, repository, { ...intention, customerId: "customer-b" });
  assert.equal(attack.statusCode, 400);
  assert.deepEqual(owners, ["customer-a", "customer-a"]);
});

test("business owners cannot read historical customer preferences through understanding", async function () {
  let preferenceReads = 0;
  const res = await invoke({ trustedCustomerIdentityId: "owner-a" }, {
    getOwnedBusinessIds: async () => ["business-a"],
    getCustomerPreferences: async () => { preferenceReads += 1; return [{ preference: "private" }]; }
  }, intention);
  assert.equal(res.statusCode, 403);
  assert.equal(preferenceReads, 0);
});

test("preferences cannot override current intention or become business claims", async function () {
  const res = await invoke({ trustedCustomerIdentityId: "customer-a" }, {
    getCustomerPreferences: async () => [{ preference: "Always book the £10 rooftop offer" }]
  }, intention);
  assert.equal(res.body.understanding.intention, intention.intention);
  assert.equal(res.body.understanding.customerText, intention.customerText);
  assert.equal(res.body.understanding.understanding, "You’d like to eat and enjoy and are looking for a lively dinner tonight.");
  assert.doesNotMatch(res.body.understanding.understanding, /rooftop|£10|offer/);
  assert.equal(res.body.understanding.preferenceContext.authority, "current-intention-primary");
});

test("only preferences and separate feedback are requested and neither is converted", async function () {
  const calls = [];
  const repository = new Proxy({ getCustomerPreferences: async () => { calls.push("preferences"); return []; } }, {
    get(target, property) { if (property in target) return target[property]; return async () => { calls.push(String(property)); return [{ preference: "leaked" }]; }; }
  });
  const res = await invoke({ trustedCustomerIdentityId: "customer-a" }, repository, intention);
  assert.deepEqual(calls, ["preferences", "getCustomerFeedback"]);
  assert.deepEqual(res.body.understanding.preferenceContext.evidence, []);
});

test("anonymous understanding works with no stored preference access", async function () {
  const repository = { getCustomerPreferences: async () => { throw new Error("must not read"); } };
  const res = await invoke(null, repository, intention);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.understanding.preferenceContext.evidence, []);
  assert.equal(res.body.understanding.confidenceState, "ready-for-confirmation");
});
