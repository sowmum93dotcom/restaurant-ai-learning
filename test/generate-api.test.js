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

async function generate(body = {}, options = {}) {
  let fetchCalls = 0;
  let fetchBody;
  const authorizationCalls = [];
  const knownBusinessCalls = [];
  const repository = {
    async getKnownBusiness(businessId) {
      knownBusinessCalls.push(businessId);
      return options.storedBusiness === undefined
        ? { businessProfile: options.persistedProfile || businessProfile }
        : options.storedBusiness;
    }
  };
  const requireFromGenerate = function (specifier) {
    if (specifier === "./_lib/persistence.js") {
      return { getRepository() { return repository; } };
    }
    if (specifier === "./_lib/demeos-business-owner-authorization.js") {
      return {
        async authorizeBusinessOwnerRequest(input) {
          authorizationCalls.push(input);
          return {
            authenticated: options.authenticated !== false,
            allowed: options.allowed !== false
          };
        }
      };
    }
    if (specifier === "./_lib/demeos-rules.js") {
      return { DEMEOS_ACTIONS: { CREATE_MARKETING: "create-marketing" } };
    }
    throw new Error(`Unexpected require: ${specifier}`);
  };
  const context = {
    module: { exports: {} },
    require: requireFromGenerate,
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
  const request = {
    method: "POST",
    body: { businessId: "business-a", businessProfile, ...body },
    query: { trustedIdentityId: "query-attacker", userId: "query-attacker" },
    headers: { "x-user-id": "header-attacker", "x-actor-scope": "business-owner" },
    localStorage: { trustedIdentityId: "browser-attacker" }
  };

  await context.module.exports(request, response);

  return { response, request, fetchCalls, fetchBody, authorizationCalls, knownBusinessCalls, repository };
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

test("a persisted complete Business Manager Profile proceeds", async function () {
  const result = await generate({ promoText: "Promote our Friday dinner." });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.fetchCalls, 1);
});

test("unauthenticated generation returns 401 without loading the business or calling OpenAI", async function () {
  const result = await generate({ promoText: "Invalid requests must remain private.", campaignType: "invalid" }, {
    authenticated: false,
    allowed: false
  });

  assert.equal(result.response.statusCode, 401);
  assert.equal(result.response.body.error, "Authentication required.");
  assert.deepEqual(result.knownBusinessCalls, []);
  assert.equal(result.fetchCalls, 0);
});

test("an authenticated non-owner receives 403 without loading the business or calling OpenAI", async function () {
  const result = await generate({ businessId: "business-b", promoText: "Promote dinner." }, { allowed: false });

  assert.equal(result.response.statusCode, 403);
  assert.equal(result.response.body.error, "Forbidden.");
  assert.deepEqual(result.knownBusinessCalls, []);
  assert.equal(result.fetchCalls, 0);
});

test("owner authorization uses CREATE_MARKETING and the requested businessId", async function () {
  const result = await generate({ businessId: " business-owner-request ", promoText: "Promote dinner." });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.authorizationCalls.length, 1);
  assert.equal(result.authorizationCalls[0].action, "create-marketing");
  assert.equal(result.authorizationCalls[0].businessId, "business-owner-request");
  assert.equal(result.authorizationCalls[0].req, result.request);
  assert.equal(result.authorizationCalls[0].repository, result.repository);
  assert.deepEqual(result.knownBusinessCalls, ["business-owner-request"]);
});

test("spoofed profile identity and request identity fields cannot change authorization or loading scope", async function () {
  const result = await generate({
    businessId: "business-a",
    promoText: "Promote dinner.",
    businessProfile: { ...businessProfile, businessId: "business-b" },
    trustedIdentityId: "body-attacker",
    userId: "body-attacker",
    actorScope: "business-owner"
  });

  assert.equal(result.authorizationCalls[0].businessId, "business-a");
  assert.deepEqual(result.knownBusinessCalls, ["business-a"]);
});

test("spoofed browser profile facts cannot replace persisted facts in the OpenAI prompt", async function () {
  const persistedProfile = {
    name: "Persisted Bistro", type: "Bistro", location: "Leeds", brandVoice: "Direct",
    targetCustomer: "Office workers", goal: "Increase lunch visits"
  };
  const spoofedProfile = {
    businessId: "business-b", name: "Spoofed Cafe", type: "Nightclub", location: "Paris",
    brandVoice: "Hyped", targetCustomer: "Attackers", goal: "Replace verified facts"
  };
  const result = await generate({
    promoText: "Promote lunch.",
    businessProfile: spoofedProfile
  }, { persistedProfile });

  assert.equal(result.response.statusCode, 200);
  for (const fact of Object.values(persistedProfile)) assert.match(result.fetchBody.input, new RegExp(fact));
  for (const fact of Object.values(spoofedProfile)) assert.doesNotMatch(result.fetchBody.input, new RegExp(fact));
});

test("an authorized owner can revise marketing for the requested business", async function () {
  const result = await generate({
    businessId: "business-a",
    existingCampaign: "Original owner campaign",
    revisionInstruction: "Make the call to action clearer."
  });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.fetchCalls, 1);
  assert.match(result.fetchBody.input, /Original owner campaign/);
  assert.deepEqual(result.knownBusinessCalls, ["business-a"]);
});

test("a missing stored business returns 404 without calling OpenAI", async function () {
  const result = await generate({ businessId: "missing-business", promoText: "Promote dinner." }, {
    storedBusiness: null
  });

  assert.equal(result.response.statusCode, 404);
  assert.equal(result.response.body.error, "Business not found.");
  assert.deepEqual(result.knownBusinessCalls, ["missing-business"]);
  assert.equal(result.fetchCalls, 0);
});

for (const invalidBusinessId of [undefined, null, "", "   ", 42]) {
  test(`invalid businessId ${String(invalidBusinessId)} is rejected`, async function () {
    const result = await generate({ businessId: invalidBusinessId, promoText: "Promote dinner." });
    assert.equal(result.response.statusCode, 400);
    assert.equal(result.response.body.error, "A businessId is required.");
    assert.equal(result.authorizationCalls.length, 0);
    assert.equal(result.fetchCalls, 0);
  });
}

for (const [description, invalidBusinessProfile] of [
  ["missing", undefined],
  ["null", null],
  ["string", "DEMEOS Kitchen"],
  ["number", 42],
  ["boolean", true],
  ["array", []]
]) {
  test(`${description} persisted businessProfile is rejected before fetch`, async function () {
    const result = await generate(
      { promoText: "Promote our Friday dinner." },
      { storedBusiness: { businessProfile: invalidBusinessProfile } }
    );

    assert.equal(result.response.statusCode, 400);
    assert.equal(
      result.response.body.error,
      "Please complete and save the Business Manager Profile before creating marketing work."
    );
    assert.equal(result.fetchCalls, 0);
  });
}

for (const field of ["name", "type", "location", "brandVoice", "targetCustomer", "goal"]) {
  test(`persisted businessProfile requires ${field}`, async function () {
    const invalidBusinessProfile = { ...businessProfile };
    delete invalidBusinessProfile[field];
    const result = await generate(
      { promoText: "Promote our Friday dinner." },
      { persistedProfile: invalidBusinessProfile }
    );

    assert.equal(result.response.statusCode, 400);
    assert.equal(result.fetchCalls, 0);
  });
}

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

test("a revision with an invalid persisted profile is rejected before fetch", async function () {
  const result = await generate({
    existingCampaign: "Original campaign",
    revisionInstruction: "Make the call to action clearer."
  }, { persistedProfile: { ...businessProfile, targetCustomer: "" } });

  assert.equal(result.response.statusCode, 400);
  assert.equal(
    result.response.body.error,
    "Please complete and save the Business Manager Profile before creating marketing work."
  );
  assert.equal(result.fetchCalls, 0);
});
