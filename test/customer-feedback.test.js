const assert = require("node:assert/strict");
const test = require("node:test");
const { parseCustomerFeedback, CUSTOMER_FEEDBACK_TYPE } = require("../api/_lib/customer-feedback-contract.js");
const { createPersistenceRepository } = require("../api/_lib/persistence.js");
const { recordCustomerFeedback, CUSTOMER_STAGE_SIX_COPY } = require("../js/customer.js");

function response() {
  return { statusCode: 0, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function runFeedbackRoute(repository, req) {
  const persistencePath = require.resolve("../api/_lib/persistence.js");
  const routePath = require.resolve("../api/customer/work/[campaignId]/participation.js");
  const persistence = require(persistencePath);
  const auth = require("../api/_lib/demeos-customer-authentication.js");
  const original = persistence.getRepository;
  const originalAuth = auth.resolveTrustedCustomerIdentityFromRequest;
  persistence.getRepository = function () { return repository; };
  auth.resolveTrustedCustomerIdentityFromRequest = async function () { return { trustedCustomerIdentityId: "trusted-customer" }; };
  if (typeof repository.getOwnedBusinessIds !== "function") repository.getOwnedBusinessIds = async function () { return []; };
  delete require.cache[routePath];
  const handler = require(routePath);
  const res = response();
  const request = { ...req, query: { ...(req.query || {}), interaction: "feedback" } };
  try { await handler(request, res); } finally { persistence.getRepository = original; auth.resolveTrustedCustomerIdentityFromRequest = originalAuth; delete require.cache[routePath]; }
  return res;
}

test("feedback contract preserves relevance-only semantics", function () {
  assert.deepEqual(parseCustomerFeedback({ response: "Relevant", comment: "  useful direction  " }), {
    feedbackType: CUSTOMER_FEEDBACK_TYPE, response: "Relevant", comment: "useful direction"
  });
  assert.deepEqual(parseCustomerFeedback({ response: "Not quite" }), {
    feedbackType: CUSTOMER_FEEDBACK_TYPE, response: "Not quite"
  });
  assert.equal(parseCustomerFeedback({ response: "Great" }), null);
  assert.equal(parseCustomerFeedback({ response: "Relevant", comment: "x".repeat(501) }), null);
  assert.equal(parseCustomerFeedback({ response: "Relevant", businessId: "browser-value" }), null);
});

test("feedback client sends only response and trimmed optional comment", async function () {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async function (url, options) { requests.push({ url, options }); return { ok: true }; };
  try {
    await recordCustomerFeedback({ workItemId: "work/a" }, { response: "Relevant", comment: "  helpful  " });
  } finally { global.fetch = originalFetch; }
  assert.equal(requests[0].url, "/api/customer/work/work%2Fa/feedback");
  assert.deepEqual(JSON.parse(requests[0].options.body), { response: "Relevant", comment: "helpful" });
});

test("Stage 6 has exactly three relevance choices and neutral success copy", function () {
  assert.deepEqual(CUSTOMER_STAGE_SIX_COPY.choices.map((choice) => choice.label), [
    "Yes, this was relevant", "Not quite", "I need something different"
  ]);
  assert.equal(CUSTOMER_STAGE_SIX_COPY.success, "Thank you. Your feedback will help DEMEOS understand better.");
});

test("repository stores feedback separately for a current publishable campaign", async function () {
  const queries = [];
  const campaign = { campaignType: "social", campaignText: "A useful possibility", approvalStatus: "Approved" };
  const repository = createPersistenceRepository({ async ensureSchema() {}, async query(statement, values) {
    queries.push({ statement, values });
    if (queries.length === 1) return { rows: [{ business_id: "stored-business", campaign }] };
    return { rows: [{ response: "Relevant" }] };
  }});
  const result = await repository.recordCustomerFeedback("campaign-a", {
    feedbackType: CUSTOMER_FEEDBACK_TYPE, response: "Relevant", comment: "Helpful"
  }, "trusted-customer-a");
  assert.deepEqual(result, { response: "Relevant" });
  assert.match(queries[1].statement, /INSERT INTO demeos_customer_feedback/);
  assert.doesNotMatch(queries[1].statement, /demeos_customer_participations/);
  assert.equal(queries[1].values[4], "stored-business");
  assert.equal(queries[1].values[6], "trusted-customer-a");
  assert.match(queries[1].statement, /trusted_customer_identity_id/);
});

test("feedback endpoint keeps feedback type and business identity server-authoritative", async function () {
  let received;
  const res = await runFeedbackRoute({ async recordCustomerFeedback(campaignId, feedback, customerId) {
    received = { campaignId, feedback, customerId }; return { response: feedback.response };
  }}, { method: "POST", query: { campaignId: "campaign-a" }, body: { response: "Relevant", comment: "  useful  " } });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(received, { campaignId: "campaign-a", feedback: {
    feedbackType: "possibility-relevance", response: "Relevant", comment: "useful"
  }, customerId: "trusted-customer" });
  assert.deepEqual(res.body, { feedback: { response: "Relevant" } });
});

test("feedback endpoint rejects invalid input and missing publishable work", async function () {
  const invalid = await runFeedbackRoute({ async recordCustomerFeedback() { return { response: "Relevant" }; } },
    { method: "POST", query: { campaignId: "campaign-a" }, body: { response: "Unsupported" } });
  assert.equal(invalid.statusCode, 400);
  const unavailable = await runFeedbackRoute({ async recordCustomerFeedback() { return null; } },
    { method: "POST", query: { campaignId: "campaign-a" }, body: { response: "Not quite" } });
  assert.equal(unavailable.statusCode, 404);
});
