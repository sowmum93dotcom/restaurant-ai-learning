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
  const routePath = require.resolve("../api/customer/work/[campaignId]/feedback.js");
  const persistence = require(persistencePath);
  const original = persistence.getRepository;
  persistence.getRepository = function () { return repository; };
  delete require.cache[routePath];
  const handler = require(routePath);
  const res = response();
  try { await handler(req, res); } finally { persistence.getRepository = original; delete require.cache[routePath]; }
  return res;
}

test("feedback contract accepts only relevance responses and trims optional plain text", function () {
  assert.deepEqual(parseCustomerFeedback({ response: "Relevant", comment: "  useful direction  " }), {
    feedbackType: "possibility-relevance", response: "Relevant", comment: "useful direction"
  });
  assert.deepEqual(parseCustomerFeedback({ response: "Not quite", comment: "   " }), {
    feedbackType: CUSTOMER_FEEDBACK_TYPE, response: "Not quite"
  });
  assert.deepEqual(parseCustomerFeedback({ response: "Something different" }), {
    feedbackType: CUSTOMER_FEEDBACK_TYPE, response: "Something different"
  });
});

test("feedback contract rejects malformed, unsupported, oversized, HTML, and browser authority", function () {
  for (const body of [null, [], "Relevant", {}, { response: "Yes" }, { response: 5 },
    { response: "Relevant", comment: "x".repeat(501) }, { response: "Relevant", comment: "<b>yes</b>" },
    { response: "Relevant", businessId: "spoof" },
    { response: "Relevant", feedbackType: "customer-satisfaction" },
    { response: "Relevant", rating: 5 }, { response: "Relevant", purchased: true }]) {
    assert.equal(parseCustomerFeedback(body), null);
  }
});

test("feedback client sends only response and trimmed comment and never submits by itself", async function () {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async function (url, options) { requests.push({ url, options }); return { ok: true }; };
  try {
    assert.equal(requests.length, 0);
    await recordCustomerFeedback({ workItemId: "work/a", businessId: "browser" },
      { response: "Relevant", comment: "  helpful  " });
  } finally { global.fetch = originalFetch; }
  assert.equal(requests[0].url, "/api/customer/work/work%2Fa/feedback");
  assert.deepEqual(JSON.parse(requests[0].options.body), { response: "Relevant", comment: "helpful" });
});

test("Stage 6 copy has exactly three non-rating relevance choices and neutral success language", function () {
  assert.deepEqual(CUSTOMER_STAGE_SIX_COPY.choices.map((choice) => choice.label), [
    "Yes, this was relevant", "Not quite", "I need something different"
  ]);
  assert.doesNotMatch(JSON.stringify(CUSTOMER_STAGE_SIX_COPY), /\bstar\b|rating|score|percentage|purchased|satisfied|business was/i);
  assert.equal(CUSTOMER_STAGE_SIX_COPY.success,
    "Thank you. Your feedback will help DEMEOS understand better.");
});

test("repository resolves business from current publishable campaign and inserts dedicated feedback", async function () {
  const queries = [];
  const campaign = { campaignType: "social", campaignText: "A useful possibility", approvalStatus: "Approved" };
  const repository = createPersistenceRepository({ async ensureSchema() {}, async query(statement, values) {
    queries.push({ statement, values });
    if (queries.length === 1) return { rows: [{ business_id: "stored-business", campaign }] };
    return { rows: [{ response: "Relevant" }] };
  }});
  const result = await repository.recordCustomerFeedback("campaign-a", {
    feedbackType: CUSTOMER_FEEDBACK_TYPE, response: "Relevant", comment: "Helpful"
  });
  assert.deepEqual(result, { response: "Relevant" });
  assert.match(queries[1].statement, /INSERT INTO demeos_customer_feedback/);
  assert.doesNotMatch(queries[1].statement, /demeos_customer_participations/);
  assert.equal(queries[1].values[4], "stored-business");
});

test("repository rejects unavailable feedback work before inserting", async function () {
  let count = 0;
  const repository = createPersistenceRepository({ async ensureSchema() {}, async query() {
    count += 1; return { rows: [{ business_id: "business", campaign: {
      campaignType: "social", campaignText: "Draft", approvalStatus: "Unapproved"
    }}] };
  }});
  assert.equal(await repository.recordCustomerFeedback("draft", {
    feedbackType: CUSTOMER_FEEDBACK_TYPE, response: "Relevant"
  }), null);
  assert.equal(count, 1);
});

test("feedback endpoint makes type and identities authoritative and minimizes confirmation", async function () {
  let received;
  const res = await runFeedbackRoute({ async recordCustomerFeedback(campaignId, feedback) {
    received = { campaignId, feedback }; return { response: feedback.response, internalId: 42 };
  }}, { method: "POST", query: { campaignId: "campaign-a" }, body: {
    response: "Relevant", comment: "  useful  "
  }});
  assert.equal(res.statusCode, 201);
  assert.deepEqual(received, { campaignId: "campaign-a", feedback: {
    feedbackType: "possibility-relevance", response: "Relevant", comment: "useful"
  }});
  assert.deepEqual(res.body, { feedback: { response: "Relevant" } });

  for (const body of [{ response: "Relevant", businessId: "spoof" },
    { response: "Relevant", feedbackType: "spoof" }, { response: "Great" }]) {
    const invalid = await runFeedbackRoute({ async recordCustomerFeedback() { throw new Error("must not run"); } },
      { method: "POST", query: { campaignId: "campaign-a" }, body });
    assert.equal(invalid.statusCode, 400);
  }
});

test("feedback endpoint returns not found for work no longer publishable", async function () {
  const res = await runFeedbackRoute({ async recordCustomerFeedback() { return null; } },
    { method: "POST", query: { campaignId: "campaign-a" }, body: { response: "Not quite" } });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: "Approved DEMEOS work was not found." });
});
