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
  let fetchBody;
  const context = {
    module: { exports: {} },
    process: { env: { OPENAI_API_KEY: "test-key" } },
    console,
    fetch: async function (url, options) {
      fetchCalls += 1;
      fetchBody = JSON.parse(options.body);
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

  return { response, fetchCalls, fetchBody };
}

for (const [description, body, expectedCampaignType] of [
  ["omitted campaignType defaults to full", {}, "full"],
  ["full campaignType", { campaignType: "full" }, "full"],
  ["social campaignType", { campaignType: "social" }, "social"],
  ["email campaignType", { campaignType: "email" }, "email"]
]) {
  test(`${description} proceeds to generation`, async function () {
    const result = await generate({ promoText: "Promote our Friday dinner.", ...body });

    assert.equal(result.response.statusCode, 200);
    assert.equal(result.fetchCalls, 1);
    assert.match(result.fetchBody.input, new RegExp(`Campaign type requested: ${expectedCampaignType}`));
  });
}

for (const [description, campaignType] of [
  ["unsupported string", "video"],
  ["empty", ""],
  ["whitespace-only", "   "],
  ["non-string", 42]
]) {
  test(`${description} campaignType is rejected`, async function () {
    const result = await generate({ promoText: "Promote our Friday dinner.", campaignType });

    assert.equal(result.response.statusCode, 400);
    assert.equal(result.response.body.error, "Please select a valid marketing campaign type.");
    assert.equal(result.fetchCalls, 0);
  });
}

test("an invalid campaignType is rejected for a revision", async function () {
  const result = await generate({
    campaignType: "video",
    existingCampaign: "Original campaign",
    revisionInstruction: "Make the call to action clearer."
  });

  assert.equal(result.response.statusCode, 400);
  assert.equal(result.response.body.error, "Please select a valid marketing campaign type.");
  assert.equal(result.fetchCalls, 0);
});

test("a complete valid Business Manager Profile proceeds", async function () {
  const result = await generate({ promoText: "Promote our Friday dinner." });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.fetchCalls, 1);
});

for (const [description, invalidBusinessProfile] of [
  ["missing", undefined],
  ["null", null],
  ["string", "DEMEOS Kitchen"],
  ["number", 42],
  ["boolean", true],
  ["array", []]
]) {
  test(`${description} businessProfile is rejected before fetch`, async function () {
    const result = await generate({
      promoText: "Promote our Friday dinner.",
      businessProfile: invalidBusinessProfile
    });

    assert.equal(result.response.statusCode, 400);
    assert.equal(
      result.response.body.error,
      "Please complete and save the Business Manager Profile before creating marketing work."
    );
    assert.equal(result.fetchCalls, 0);
  });
}

for (const field of ["name", "type", "location", "brandVoice", "targetCustomer", "goal"]) {
  test(`businessProfile requires ${field}`, async function () {
    const invalidBusinessProfile = { ...businessProfile };
    delete invalidBusinessProfile[field];
    const result = await generate({
      promoText: "Promote our Friday dinner.",
      businessProfile: invalidBusinessProfile
    });

    assert.equal(result.response.statusCode, 400);
    assert.equal(result.fetchCalls, 0);
  });
}

test("a whitespace-only required businessProfile field is rejected", async function () {
  const result = await generate({
    promoText: "Promote our Friday dinner.",
    businessProfile: { ...businessProfile, brandVoice: " \n\t " }
  });

  assert.equal(result.response.statusCode, 400);
  assert.equal(result.fetchCalls, 0);
});

test("a non-string required businessProfile field is rejected", async function () {
  const result = await generate({
    promoText: "Promote our Friday dinner.",
    businessProfile: { ...businessProfile, goal: 42 }
  });

  assert.equal(result.response.statusCode, 400);
  assert.equal(result.fetchCalls, 0);
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

test("a full campaign prompt requires all five sections in exact order", async function () {
  const result = await generate({
    promoText: "Promote our Friday dinner.",
    campaignType: "full"
  });
  const input = result.fetchBody.input;

  assert.match(input, /these exact section headings in this exact order:\s+CAMPAIGN STRATEGY\s+SOCIAL MEDIA POST\s+EMAIL CAMPAIGN\s+SHORT AD COPY\s+CALL TO ACTION/);
  assert.match(input, /campaign objective, the verified Target customer, the core message and positioning, and how the campaign supports the verified Primary marketing goal/);
});

test("a social campaign prompt remains social-only", async function () {
  const result = await generate({
    promoText: "Promote our Friday dinner.",
    campaignType: "social"
  });

  assert.match(result.fetchBody.input, /Return only the finished customer-facing SOCIAL MEDIA POST/);
  assert.doesNotMatch(result.fetchBody.input, /Return one complete marketing campaign with these exact section headings/);
});

test("an email campaign prompt remains email-only", async function () {
  const result = await generate({
    promoText: "Promote our Friday dinner.",
    campaignType: "email"
  });

  assert.match(result.fetchBody.input, /Return only the EMAIL CAMPAIGN, containing one email subject line followed by the finished email body/);
  assert.doesNotMatch(result.fetchBody.input, /Return one complete marketing campaign with these exact section headings/);
});

test("a full campaign revision preserves the complete campaign structure", async function () {
  const result = await generate({
    campaignType: "full",
    existingCampaign: "CAMPAIGN STRATEGY\nOriginal campaign",
    revisionInstruction: "Make the call to action clearer."
  });

  assert.match(result.fetchBody.input, /Preserve the complete five-section campaign structure in the revised campaign/);
  assert.match(result.fetchBody.input, /CAMPAIGN STRATEGY\s+SOCIAL MEDIA POST\s+EMAIL CAMPAIGN\s+SHORT AD COPY\s+CALL TO ACTION/);
});

for (const revisionTarget of [
  "campaign_strategy", "social_media_post", "email_campaign", "short_ad_copy", "call_to_action"
]) {
  test(`a full campaign revision accepts ${revisionTarget}`, async function () {
    const result = await generate({
      campaignType: "full", existingCampaign: "Complete existing campaign",
      revisionInstruction: "Make it clearer.", revisionTarget
    });

    assert.equal(result.response.statusCode, 200);
    assert.equal(result.fetchCalls, 1);
    assert.match(result.fetchBody.input, new RegExp(`selected revision target is ${revisionTarget}`));
    assert.match(result.fetchBody.input, /Revise ONLY the selected .* section/);
    assert.match(result.fetchBody.input, /Preserve the other four sections unchanged in substance/);
    assert.match(result.fetchBody.input, /Return the COMPLETE five-section Full Marketing Campaign/);
  });
}

for (const [description, body] of [
  ["invalid", { campaignType: "full", existingCampaign: "Existing", revisionInstruction: "Change it", revisionTarget: "menu" }],
  ["new campaign", { campaignType: "full", promoText: "Promote dinner", revisionTarget: "campaign_strategy" }],
  ["social revision", { campaignType: "social", existingCampaign: "Existing", revisionInstruction: "Change it", revisionTarget: "social_media_post" }],
  ["email revision", { campaignType: "email", existingCampaign: "Existing", revisionInstruction: "Change it", revisionTarget: "email_campaign" }]
]) {
  test(`revisionTarget is rejected for ${description}`, async function () {
    const result = await generate(body);
    assert.equal(result.response.statusCode, 400);
    assert.equal(result.response.body.error, "Please select a valid campaign section to revise.");
    assert.equal(result.fetchCalls, 0);
  });
}

test("omitting revisionTarget retains whole full-campaign revision behavior", async function () {
  const result = await generate({ campaignType: "full", existingCampaign: "Existing", revisionInstruction: "Change it" });
  assert.equal(result.response.statusCode, 200);
  assert.doesNotMatch(result.fetchBody.input, /selected revision target/);
  assert.match(result.fetchBody.input, /Make only the legitimate changes requested within the relevant section or sections/);
});

test("a revision with an invalid profile is rejected before fetch", async function () {
  const result = await generate({
    businessProfile: { ...businessProfile, targetCustomer: "" },
    existingCampaign: "Original campaign",
    revisionInstruction: "Make the call to action clearer."
  });

  assert.equal(result.response.statusCode, 400);
  assert.equal(
    result.response.body.error,
    "Please complete and save the Business Manager Profile before creating marketing work."
  );
  assert.equal(result.fetchCalls, 0);
});
