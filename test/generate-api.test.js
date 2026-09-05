const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs
  .readFileSync(require.resolve("../api/generate.js"), "utf8")
  .replace("export default async function handler", "module.exports = async function handler");

const businessProfile = {
  name: "DEMEOS Kitchen",
  type: "Restaurant",
  location: "London",
  brandVoice: "Warm and professional",
  targetCustomer: "Local diners",
  goal: "Increase weekday visits"
};

function createResponse() {
  return {
    statusCode: null,
    body: null,
    setHeader() {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function generate(body) {
  let fetchCalls = 0;
  const context = {
    module: { exports: {} },
    process: { env: { OPENAI_API_KEY: "test-key" } },
    console,
    fetch: async function () {
      fetchCalls += 1;
      return {
        ok: true,
        headers: { get() { return null; } },
        async text() { return JSON.stringify({ output_text: "Generated campaign" }); }
      };
    }
  };
  vm.runInNewContext(source, context);
  const response = createResponse();

  await context.module.exports({ method: "POST", body: { businessProfile, ...body } }, response);

  return { response, fetchCalls };
}

test("a non-empty marketing request proceeds to generation", async function () {
  const result = await generate({ promoText: "Promote our Friday dinner." });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.fetchCalls, 1);
});

for (const [description, body] of [
  ["missing", {}],
  ["empty", { promoText: "" }],
  ["whitespace-only", { promoText: " \n\t " }],
  ["non-string", { promoText: 42 }]
]) {
  test(`${description} promoText is rejected`, async function () {
    const result = await generate(body);

    assert.equal(result.response.statusCode, 400);
    assert.equal(result.response.body.error, "Please describe what you would like to promote.");
    assert.equal(result.fetchCalls, 0);
  });
}

test("a valid revision remains unaffected without promoText", async function () {
  const result = await generate({
    existingCampaign: "Original campaign",
    revisionInstruction: "Make the call to action clearer."
  });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.fetchCalls, 1);
});
