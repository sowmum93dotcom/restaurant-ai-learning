const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../api/recommend.js"), "utf8")
  .replace("export default async function handler", "module.exports = async function handler");

function buildRecommendations(profile, firstReason, includeParticipationEvidence) {
  return { recommendations: ["One", "Two", "Three"].map((title, index) => ({
    title,
    reason: index === 0 ? firstReason : `Reason ${index}`,
    targetCustomer: profile.targetCustomer,
    businessObjective: `${profile.goal}: objective ${index}`,
    demeosCapability: ["Full Marketing Campaign", "Social Media Campaign", "Email Campaign"][index],
    suggestedRequest: `Request ${index}`,
    suggestedCampaignType: ["full", "social", "email"][index],
    evidence: [
      { source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" },
      ...(index === 0 && includeParticipationEvidence ? [{
        source: "customerParticipation", field: "customerInterestCount", value: "4",
        verificationState: "systemRecordedInterest"
      }] : [])
    ],
    expectedOutcome: `Aims to support ${profile.goal} by encouraging customer interest`,
    requiredInput: [],
    approvalState: "pending"
  })) };
}

async function call(profile, recommendations) {
  const repository = {
    async getKnownBusiness() {
      return {
        businessProfile: { ...profile, businessId: "business-a" },
        campaigns: [],
        recommendationDecisions: [],
        customerParticipationResults: [
          { businessId: "business-a", name: "Approved work", customerInterestCount: 4 }
        ]
      };
    }
  };
  const context = {
    module: { exports: {} },
    process: { env: { OPENAI_API_KEY: "key" } },
    console,
    require(id) {
      if (id === "./_lib/capability-registry.js") return require("../api/_lib/capability-registry.js");
      if (id === "../api/_lib/persistence.js") return { getRepository() { return repository; } };
      if (id === "../api/_lib/demeos-business-owner-authorization.js") {
        return { async authorizeBusinessOwnerRequest() { return { authenticated: true, allowed: true }; } };
      }
      if (id === "../api/_lib/demeos-rules.js") return require("../api/_lib/demeos-rules.js");
      if (id === "./_lib/campaign-outcome-contract.js") return require("../api/_lib/campaign-outcome-contract.js");
      return require(id);
    },
    fetch: async () => ({
      ok: true,
      headers: { get() { return null; } },
      async text() { return JSON.stringify({ output_text: JSON.stringify(recommendations) }); }
    })
  };
  vm.runInNewContext(source, context);
  const response = {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await context.module.exports({ method: "POST", body: { businessId: "business-a", businessSituation: "" } }, response);
  return response;
}

test("verified sales goal is not rejected merely because participation evidence is present", async () => {
  const profile = {
    name: "North Star", type: "Consultancy", location: "Leeds", brandVoice: "Clear and calm",
    targetCustomer: "Local small businesses", goal: "Increase sales"
  };
  const response = await call(profile,
    buildRecommendations(profile, "Customer interest is an interest signal only.", true));
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.recommendations.length, 3);
});

test("participation overclaim is rejected even when the model omits participation evidence", async () => {
  const profile = {
    name: "North Star", type: "Consultancy", location: "Leeds", brandVoice: "Clear and calm",
    targetCustomer: "Local small businesses", goal: "Build awareness"
  };
  const response = await call(profile,
    buildRecommendations(profile, "Four interested customers prove sales", false));
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.validationDiagnostic[0].reason, "interest-overclaim");
});
