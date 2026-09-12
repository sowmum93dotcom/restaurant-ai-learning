const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../api/recommend.js"), "utf8")
  .replace("export default async function handler", "module.exports = async function handler");

const profile = {
  name: "Mamma Pizza",
  type: "Pizza / Restaurant",
  location: "Lewisham",
  brandVoice: "Warm and welcoming",
  targetCustomer: "Local families and office workers",
  goal: "Increase local customers and repeat visits"
};
const situation = "Tuesday evenings are quiet and I would like to attract more local customers.";

function item(title, type, capability) {
  return {
    title,
    reason: "Create grounded marketing for the owner-provided quiet Tuesday evening situation.",
    targetCustomer: profile.targetCustomer,
    businessObjective: `${profile.goal} by addressing quiet Tuesday evenings`,
    demeosCapability: capability,
    suggestedRequest: `Create a ${type === "full" ? "full marketing" : type} campaign for Mamma Pizza focused on the owner-provided quiet Tuesday evening situation and attracting more local customers.`,
    suggestedCampaignType: type,
    evidence: [
      { source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" },
      { source: "businessSituation", field: "businessSituation", value: situation, verificationState: "ownerProvided" }
    ],
    expectedOutcome: `This campaign aims to support ${profile.goal} by encouraging customer interest in Tuesday evening visits.`,
    requiredInput: [],
    approvalState: "pending"
  };
}

const valid = {
  recommendations: [
    item("Tuesday Local Awareness", "full", "Full Marketing Campaign"),
    item("Tuesday Social Awareness", "social", "Social Media Campaign"),
    item("Tuesday Email Awareness", "email", "Email Campaign")
  ]
};

test("invalid first model output is repaired once and valid recommendations are returned", async () => {
  let calls = 0;
  const context = {
    module: { exports: {} },
    process: { env: { OPENAI_API_KEY: "key" } },
    console,
    require(id) {
      if (id === "../api/_lib/persistence.js") return { getRepository: () => ({ getKnownBusiness: async (businessId) => ({ businessProfile: { ...profile, businessId }, campaigns: [], recommendationDecisions: [] }) }) };
      if (id === "../api/_lib/demeos-business-owner-authorization.js") return { authorizeBusinessOwnerRequest: async () => ({ authenticated: true, allowed: true }) };
      if (id === "../api/_lib/demeos-rules.js") return require("../api/_lib/demeos-rules.js");
      return id === "./_lib/capability-registry.js"
        ? require("../api/_lib/capability-registry.js")
        : require(id);
    },
    fetch: async () => {
      calls += 1;
      const output = calls === 1 ? { recommendations: [] } : valid;
      return {
        ok: true,
        headers: { get() { return `request-${calls}`; } },
        async text() { return JSON.stringify({ output_text: JSON.stringify(output) }); }
      };
    }
  };
  vm.runInNewContext(source, context);
  const response = {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  await context.module.exports({
    method: "POST",
    body: { businessId: "business-a", businessProfile: profile, businessSituation: situation }
  }, response);

  assert.equal(calls, 2);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.recommendations.length, 3);
});
