const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  MAX_POSSIBILITIES, findCustomerPossibilities, validateConfirmedUnderstanding
} = require("../api/_lib/customer-possibility-contract.js");
const { buildCustomerUnderstanding, confirmCustomerUnderstanding } = require("../js/customer-understanding.js");

const persistencePath = require.resolve("../api/_lib/persistence.js");
const authenticationPath = require.resolve("../api/_lib/demeos-customer-authentication.js");
function confirmed(intention, text) {
  return confirmCustomerUnderstanding(buildCustomerUnderstanding(intention, text));
}
function work(id, content, extra = {}) {
  return { workItemId: id, businessName: "North Star", content,
    participationAction: "Interested", ...extra };
}
function response() {
  return { statusCode: null, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}
async function post(body, repository = { async getCustomerWork() { return []; } }) {
  const persistence = require(persistencePath);
  const issuanceTrust = require("../api/_lib/customer-possibility-issuance-trust.js");
  const original = persistence.getRepository;
  const originalPrepare = issuanceTrust.prepareCustomerPossibilityIssuanceTrust;
  const originalConfirm = issuanceTrust.confirmCustomerPossibilityIssuanceDelivery;
  persistence.getRepository = function () { return repository; };
  issuanceTrust.prepareCustomerPossibilityIssuanceTrust = async function () {};
  issuanceTrust.confirmCustomerPossibilityIssuanceDelivery = async function (_identity, ids) { return ids; };
  const routePath = require.resolve("../api/customer/possibilities.js");
  delete require.cache[routePath];
  const handler = require(routePath);
  const res = response();
  try { await handler({ method: "POST", body }, res); }
  finally { persistence.getRepository = original; issuanceTrust.prepareCustomerPossibilityIssuanceTrust = originalPrepare;
    issuanceTrust.confirmCustomerPossibilityIssuanceDelivery = originalConfirm; delete require.cache[routePath]; }
  return res;
}

async function postAs(identity, body, repository) {
  const authentication = require(authenticationPath);
  const original = authentication.resolveTrustedCustomerIdentityFromRequest;
  authentication.resolveTrustedCustomerIdentityFromRequest = async function () { return identity; };
  try { return await post(body, repository); }
  finally { authentication.resolveTrustedCustomerIdentityFromRequest = original; }
}

test("confirmed understanding contract rejects malformed, unconfirmed, wrong-source and unsupported input", function () {
  const valid = confirmed("Spend time together", "relaxed family dinner");
  assert.ok(validateConfirmedUnderstanding({ understanding: valid }));
  assert.equal(validateConfirmedUnderstanding(), null);
  assert.equal(validateConfirmedUnderstanding({ understanding: [] }), null);
  assert.equal(validateConfirmedUnderstanding({ understanding: valid, extra: true }), null);
  assert.equal(validateConfirmedUnderstanding({ understanding: { ...valid, confidenceState: "ready-for-confirmation" } }), null);
  assert.equal(validateConfirmedUnderstanding({ understanding: { ...valid, source: "demeos-inferred" } }), null);
  assert.equal(validateConfirmedUnderstanding({ understanding: { ...valid, intention: "Find the best" } }), null);
  assert.equal(validateConfirmedUnderstanding({ understanding: { ...valid, understanding: "" } }), null);
  assert.equal(validateConfirmedUnderstanding({ understanding: { ...valid, understanding: "Invented browser claim" } }), null);
});

test("contract accepts confirmed free text alone and rejects oversized fields", function () {
  assert.ok(validateConfirmedUnderstanding({ understanding: confirmed("", "relaxed family dinner") }));
  const oversized = { intention: "", customerText: "x".repeat(501), understanding: "safe",
    source: "customer-provided", confidenceState: "confirmed" };
  assert.equal(validateConfirmedUnderstanding({ understanding: oversized }), null);
});

test("family dinner has explicit evidence while bicycle repair and generic words do not", function () {
  const approved = [work("dinner", "Join us for a relaxed family dinner this evening.")];
  const matches = findCustomerPossibilities(confirmed("Spend time together", "relaxed dinner with my family"), approved);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].relevance.evidence, ["dinner", "family", "relaxed"]);
  assert.deepEqual(findCustomerPossibilities(confirmed("Get something done", "repair my bicycle"),
    [work("restaurant", "Enjoy dinner tonight at our restaurant")]), []);
  assert.deepEqual(findCustomerPossibilities(confirmed("", "I want the business today"),
    [work("generic", "The business you want today")]), []);
});

test("business name and location are never relevance signals", function () {
  const request = confirmed("Get something done", "repair bicycle");
  assert.deepEqual(findCustomerPossibilities(request,
    [work("identity", "Enjoy a wonderful dinner", { businessName: "Repair Bicycle", location: "Bicycle Repair" })]), []);
});

test("results are minimized, stable, capped and contain only evidence present on both sides", function () {
  const request = confirmed("", "relaxed family dinner");
  const stored = Array.from({ length: 9 }, function (_, index) {
    return work("work-" + index, "A relaxed family dinner", { internalDatabaseId: index, score: 99, ranking: index });
  });
  const first = findCustomerPossibilities(request, stored);
  const second = findCustomerPossibilities(request, stored);
  assert.equal(first.length, MAX_POSSIBILITIES);
  assert.deepEqual(first, second);
  first.forEach(function (possibility) {
    assert.deepEqual(Object.keys(possibility).sort(),
      ["businessName", "content", "participationAction", "possibilityId", "relevance", "workItemId"].sort());
    assert.match(possibility.possibilityId, /^possibility_/);
    assert.doesNotMatch(JSON.stringify(possibility), /internalDatabaseId|score|percentage|ranking/);
    possibility.relevance.evidence.forEach(function (term) {
      assert.match(request.customerText, new RegExp(term, "i"));
      assert.match(possibility.content, new RegExp(term, "i"));
    });
  });
});

test("malformed stored work stays excluded and no match is an empty response", async function () {
  const understanding = confirmed("", "relaxed family dinner");
  const repository = { async getCustomerWork() {
    return [null, work("bad", "relaxed family dinner", { participationAction: "Book" }),
      { ...work("also-bad", "relaxed family dinner"), content: ["not text"] }];
  } };
  const res = await post({ understanding }, repository);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { possibilities: [] });
});

test("possibilities endpoint rejects invalid requests before repository access", async function () {
  let called = false;
  const invalid = await post({ understanding: { source: "customer-provided" } }, {
    async getCustomerWork() { called = true; return []; }
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(called, false);
  const methodResponse = response();
  await require("../api/customer/possibilities.js")({ method: "GET" }, methodResponse);
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.headers.Allow, "POST");
});

test("client requests possibilities only from confirmation and sends no coordinates or marketplace features", function () {
  const source = fs.readFileSync(path.join(__dirname, "..", "js/customer.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  const confirmation = source.slice(source.indexOf('getElementById("customer-understanding-confirm")'),
    source.indexOf("function toCustomerWorkItem"));
  assert.match(confirmation, /confirmCustomerUnderstanding[\s\S]*requestCustomerPossibilities/);
  assert.equal((source.match(/requestCustomerPossibilities\(document, currentUnderstanding/g) || []).length, 1);
  const requestFunction = source.slice(source.indexOf("async function requestCustomerPossibilities"),
    source.indexOf("function getLocalGreeting"));
  assert.match(requestFunction, /\/api\/customer\/possibilities/);
  assert.doesNotMatch(requestFunction, /latitude|longitude|coordinates|geolocation/);
  assert.doesNotMatch(html + source, /best match|star rating|sponsored badge|book now|map control|marketplace filter/i);
});

test("authenticated possibilities are issued only to the trusted customer identity", async function () {
  const understanding = confirmed("Spend time together", "relaxed family dinner");
  let issuance; let savedIntention;
  const repository = {
    async getCustomerWork() { return [work("work-1", "A relaxed family dinner")]; },
    async getOwnedBusinessIds(id) { assert.equal(id, "trusted-customer-a"); return []; },
    async saveCustomerIntention(id, value) { assert.equal(id, "trusted-customer-a"); savedIntention = value; return { intentionId: "41" }; },
    async getCustomerPrivacyControls() { return { usePreferencesAsGuidance: true, useFeedbackAsGuidance: true }; },
    async getCustomerPreferences() { return []; }, async getCustomerFeedback() { return []; },
    async recordCustomerPossibilityIssuance(...args) { issuance = args; return ["work-1"]; }
  };
  const res = await postAs({ trustedCustomerIdentityId: "trusted-customer-a" }, { understanding }, repository);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.possibilities.length, 1);
  assert.equal(issuance[0], "trusted-customer-a");
  assert.equal(issuance[1][0].workItemId, "work-1");
  assert.deepEqual(savedIntention, { intention: understanding.intention, customerText: understanding.customerText,
    understanding: understanding.understanding });
  assert.equal(issuance[3], "41");
});

test("reviewable solution concepts connect equivalent current wording but never unrelated authorized work", function () {
  const request = confirmed("Get something done", "my bike needs servicing");
  const results = findCustomerPossibilities(request, [
    work("cycle", "Bicycle care and repair for local riders"),
    work("meal", "A family dinner in our restaurant")
  ]);
  assert.deepEqual(results.map((item) => item.workItemId), ["cycle"]);
  assert.deepEqual(results[0].relevance.evidence, ["bicycle care"]);
  assert.equal(results[0].relevance.explanation, "This authorized possibility connects to your current request.");
  assert.doesNotMatch(JSON.stringify(results), /score|confidence|profile/i);
});

test("browser identity spoofing cannot select another customer's issuance", async function () {
  const understanding = confirmed("Spend time together", "relaxed family dinner");
  let issuedTo;
  const repository = {
    async getCustomerWork() { return [work("work-1", "A relaxed family dinner")]; },
    async getOwnedBusinessIds() { return []; }, async getCustomerPreferences() { return []; },
    async saveCustomerIntention() { return { intentionId: "42" }; },
    async getCustomerPrivacyControls() { return { usePreferencesAsGuidance: true, useFeedbackAsGuidance: true }; },
    async getCustomerFeedback() { return []; },
    async recordCustomerPossibilityIssuance(id) { issuedTo = id; return ["work-1"]; }
  };
  const res = await postAs({ trustedCustomerIdentityId: "trusted-customer-a" }, { understanding }, repository);
  assert.equal(res.statusCode, 200);
  assert.equal(issuedTo, "trusted-customer-a");
  assert.notEqual(issuedTo, "browser-customer-b");
});

test("customer possibility guidance reads only evidence enabled by trusted privacy controls", async function () {
  const reads = [];
  const repository = {
    async getCustomerWork() { return [work("work-1", "A relaxed family dinner")]; },
    async getOwnedBusinessIds() { return []; },
    async saveCustomerIntention() { return { intentionId: "43" }; },
    async getCustomerPrivacyControls() { return { usePreferencesAsGuidance: false, useFeedbackAsGuidance: true }; },
    async getCustomerPreferences() { reads.push("preferences"); return [{ preference: "quiet" }]; },
    async getCustomerFeedback() { reads.push("feedback"); return []; },
    async recordCustomerPossibilityIssuance(_id, possibilities) { return possibilities.map((item) => item.workItemId); }
  };
  const understanding = confirmed("Spend time together", "relaxed family dinner");
  const res = await postAs({ trustedCustomerIdentityId: "trusted-customer-a" }, { understanding }, repository);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(reads, ["feedback"]);
});

test("anonymous Customer Experience stays functional and is not retroactively issued after authentication", async function () {
  const understanding = confirmed("Spend time together", "relaxed family dinner");
  let issuanceCalls = 0;
  const repository = {
    async getCustomerWork() { return [work("work-1", "A relaxed family dinner")]; },
    async recordCustomerPossibilityIssuance() { issuanceCalls += 1; return ["work-1"]; }
  };
  const res = await postAs(null, { understanding }, repository);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.possibilities.length, 1);
  assert.equal(issuanceCalls, 0);
});
