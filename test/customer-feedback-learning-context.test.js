const assert = require("node:assert/strict");
const test = require("node:test");
const auth = require("../api/_lib/demeos-customer-authentication.js");
const persistence = require("../api/_lib/persistence.js");
const { createPersistenceRepository } = persistence;
const { findCustomerPossibilities } = require("../api/_lib/customer-possibility-contract.js");

function response() {
  return { statusCode: null, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

async function understand(identity, repository, body) {
  const oldAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  const oldRepo = persistence.getRepository;
  auth.resolveTrustedCustomerIdentityFromRequest = async function () { return identity; };
  persistence.getRepository = function () { return repository; };
  const route = require.resolve("../api/public-config.js");
  delete require.cache[route];
  try {
    const res = response();
    await require(route)({ method: "POST", url: "/api/customer/understanding",
      query: { resource: "customer-understanding" }, body }, res);
    return res;
  } finally {
    auth.resolveTrustedCustomerIdentityFromRequest = oldAuth;
    persistence.getRepository = oldRepo;
    delete require.cache[route];
  }
}

const current = { intention: "Eat & enjoy", customerText: "A relaxed family dinner", clarificationText: "" };
function customerRepository(feedback) {
  return { getOwnedBusinessIds: async () => [], getCustomerPreferences: async () => [{ preference: "Quiet tables" }],
    getCustomerPrivacyControls: async () => ({ usePreferencesAsGuidance: true, useFeedbackAsGuidance: true }),
    getCustomerFeedback: async () => feedback };
}

test("authenticated customer's feedback is separate relevance-learning context with explicit provenance", async function () {
  const res = await understand({ trustedCustomerIdentityId: "customer-a" }, customerRepository([
    { response: "Relevant", possibilityContent: "Historic garden supper", comment: "Loved this" },
    { response: "Not quite", possibilityContent: "Historic loud supper" },
    { response: "Something different", possibilityContent: "Historic quick lunch" }
  ]), current);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.understanding.intention, current.intention);
  assert.equal(res.body.understanding.customerText, current.customerText);
  assert.deepEqual(res.body.understanding.preferenceContext.evidence[0], {
    value: "Quiet tables", evidenceType: "customer-explicit-preference",
    source: "authenticated-customer", role: "guidance-not-requirement"
  });
  assert.deepEqual(res.body.understanding.feedbackContext.evidence.map((item) => item.evidenceType),
    ["customer-feedback", "customer-feedback", "customer-feedback"]);
  assert.equal(res.body.understanding.feedbackContext.meaning, "possibility-relevance-only");
  assert.doesNotMatch(JSON.stringify(res.body.understanding.feedbackContext),
    /customer-explicit-preference|purchase|booking|sale|conversion|outcome|success|participation/i);
});

test("server identity alone scopes feedback and browser identity cannot select another customer", async function () {
  const owners = [];
  const repository = customerRepository([]);
  repository.getCustomerFeedback = async function (owner) {
    owners.push(owner);
    return [{ response: "Relevant", possibilityContent: owner === "customer-a" ? "A private signal" : "B leaked signal" }];
  };
  const own = await understand({ trustedCustomerIdentityId: "customer-a" }, repository, current);
  assert.deepEqual(owners, ["customer-a"]);
  assert.match(JSON.stringify(own.body), /A private signal/);
  assert.doesNotMatch(JSON.stringify(own.body), /B leaked signal/);
  const attack = await understand({ trustedCustomerIdentityId: "customer-a" }, repository,
    { ...current, customerId: "customer-b" });
  assert.equal(attack.statusCode, 400);
  assert.deepEqual(owners, ["customer-a", "customer-a"]);
});

test("anonymous understanding remains functional and never reads historical feedback", async function () {
  const repository = { getCustomerFeedback: async () => { throw new Error("must not read"); } };
  const res = await understand(null, repository, current);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.understanding.feedbackContext.evidence, []);
  assert.equal(res.body.understanding.confidenceState, "ready-for-confirmation");
});

test("feedback guides only ordering after current intention and cannot create unsupported claims", function () {
  const understanding = { intention: "Eat & enjoy", customerText: "relaxed family dinner" };
  const work = [
    { workItemId: "a", businessName: "A", content: "A relaxed family dinner in our garden", participationAction: "Interested" },
    { workItemId: "b", businessName: "B", content: "A relaxed family dinner indoors", participationAction: "Interested" },
    { workItemId: "c", businessName: "C", content: "Exclusive £10 rooftop booking offer", participationAction: "Interested" }
  ];
  const feedback = [{ response: "Relevant", possibilityContent: "A previous garden choice" },
    { response: "Not quite", possibilityContent: "An indoor choice" },
    { response: "Relevant", possibilityContent: "Exclusive £10 rooftop booking offer" }];
  const results = findCustomerPossibilities(understanding, work, 5, [], feedback);
  assert.deepEqual(results.map((item) => item.workItemId), ["a", "b"]);
  assert.doesNotMatch(JSON.stringify(results), /£10|rooftop|booking|offer/);
  results.forEach((item) => assert.equal(item.relevance.basis, "explicit-customer-intent-overlap"));
});

test("repository reads feedback only by trusted owner and preserves Customer Feedback provenance", async function () {
  const calls = [];
  const repository = createPersistenceRepository({ ensureSchema: async () => {}, async query(statement, values) {
    calls.push({ statement, values });
    return { rows: [{ response: "Relevant", comment: "Useful", created_at: new Date(),
      campaign: { campaignType: "social", campaignText: "Relaxed family dinner", approvalStatus: "Approved" } }] };
  } });
  const feedback = await repository.getCustomerFeedback("customer-a", 50);
  assert.deepEqual(calls[0].values, ["customer-a", 50]);
  assert.match(calls[0].statement, /trusted_customer_identity_id = \$1/);
  assert.deepEqual(feedback[0], { response: "Relevant", possibilityContent: "Relaxed family dinner",
    evidenceType: "customer-feedback", source: "authenticated-customer", createdAt: feedback[0].createdAt, comment: "Useful" });
  assert.equal(Number.isFinite(Date.parse(feedback[0].createdAt)), true);
});

test("feedback relevance guidance can be disabled and explicitly re-enabled", async function () {
  let feedbackReads = 0;
  const repository = customerRepository([]);
  repository.getCustomerPrivacyControls = async () => ({ usePreferencesAsGuidance: false, useFeedbackAsGuidance: false });
  repository.getCustomerFeedback = async () => { feedbackReads += 1;
    return [{ response: "Relevant", possibilityContent: "Historic garden supper" }]; };
  const disabled = await understand({ trustedCustomerIdentityId: "customer-a" }, repository, current);
  assert.deepEqual(disabled.body.understanding.feedbackContext.evidence, []);
  assert.equal(feedbackReads, 0);
  repository.getCustomerPrivacyControls = async () => ({ usePreferencesAsGuidance: false, useFeedbackAsGuidance: true });
  const enabled = await understand({ trustedCustomerIdentityId: "customer-a" }, repository, current);
  assert.equal(enabled.body.understanding.feedbackContext.evidence[0].evidenceType, "customer-feedback");
  assert.equal(feedbackReads, 1);
});
