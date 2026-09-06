const assert = require("node:assert/strict");
const test = require("node:test");

const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId]/campaigns/[campaignId]/outcome.js");

function response() {
  return {
    statusCode: null, body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function save(body, saveCampaignOutcome, query) {
  const persistence = require(persistencePath);
  const original = persistence.getRepository;
  persistence.getRepository = function () { return { saveCampaignOutcome }; };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  const res = response();
  try {
    await handler({ method: "PUT", query: query || { businessId: "business-a", campaignId: "version-a" }, body }, res);
  } finally {
    persistence.getRepository = original;
    delete require.cache[handlerPath];
  }
  return res;
}

test("an approved campaign can save an allowed outcome with its identities and timestamp", async function () {
  let received;
  const originalCampaign = { id: "version-a", businessId: "business-a", campaignText: "Original content", approvalStatus: "Approved" };
  const res = await save({ outcome: "Positive", ownerNote: "Guests mentioned it." }, async function (businessId, campaignId, outcome) {
    received = { businessId, campaignId, outcome };
    return { ...originalCampaign, outcome };
  });

  assert.equal(res.statusCode, 200);
  assert.equal(received.businessId, "business-a");
  assert.equal(received.campaignId, "version-a");
  assert.deepEqual(received.outcome, res.body.outcome);
  assert.equal(received.outcome.ownerNote, "Guests mentioned it.");
  assert.match(received.outcome.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(originalCampaign.campaignText, "Original content");
  assert.equal(originalCampaign.approvalStatus, "Approved");
});

test("an unapproved, missing, or cross-business campaign cannot receive an outcome", async function () {
  const res = await save({ outcome: "Mixed" }, async function () { return null; });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /approved campaign belonging to this business/);
});

test("only the four documented outcome values are accepted", async function () {
  for (const outcome of ["Great", "", null, 42]) {
    let called = false;
    const res = await save({ outcome }, async function () { called = true; });
    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  }
});

test("malformed identities and owner notes are rejected", async function () {
  assert.equal((await save({ outcome: "Positive" }, async function () {}, { businessId: " ", campaignId: "version-a" })).statusCode, 400);
  assert.equal((await save({ outcome: "Positive", ownerNote: {} }, async function () {})).statusCode, 400);
});
