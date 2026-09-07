const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../api/recommend.js"), "utf8")
  .replace("export default async function handler", "module.exports = async function handler");
const baseRegistry = require("../api/_lib/capability-registry.js");
const profile = { name: "North Star", type: "Consultancy", location: "Leeds", brandVoice: "Clear and calm",
  targetCustomer: "Local small businesses", goal: "Build awareness" };

function recommendations(requiredInput = []) {
  return { recommendations: ["One", "Two", "Three"].map((title, index) => ({
    title, reason: `Reason ${index}`, targetCustomer: profile.targetCustomer,
    businessObjective: `${profile.goal}: objective ${index}`,
    demeosCapability: ["Full Marketing Campaign", "Social Media Campaign", "Email Campaign"][index],
    suggestedRequest: `Request ${index}`, suggestedCampaignType: ["full", "social", "email"][index],
    evidence: [{ source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" }],
    expectedOutcome: `Aims to support ${profile.goal} by encouraging customer interest`,
    requiredInput: index === 0 ? requiredInput : [], approvalState: "pending"
  })) };
}

function registryWithFullRequiredInputs(extraInputs) {
  const capabilities = baseRegistry.getCapabilities().map((capability) => capability.supportedOutputType === "full"
    ? { ...capability, requiredInputs: [...capability.requiredInputs, ...extraInputs] }
    : capability);
  return {
    getCapabilities: () => capabilities,
    getRecommendationCapabilities: () => capabilities.filter((capability) =>
      capability.available && capability.recommendationCampaignType && capability.supportedOutputType),
    getCapabilityForRecommendationType: (type) => capabilities.find((capability) =>
      capability.available && capability.recommendationCampaignType && capability.supportedOutputType === type) || null
  };
}

async function call(output, businessSituation = "", registry = baseRegistry) {
  const context = { module: { exports: {} }, process: { env: { OPENAI_API_KEY: "key" } }, console,
    require(id) { return id === "./_lib/capability-registry.js" ? registry : require(id); },
    fetch: async () => ({ ok: true, headers: { get() { return null; } },
      async text() { return JSON.stringify({ output_text: JSON.stringify(output) }); } }) };
  vm.runInNewContext(source, context);
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  await context.module.exports({ method: "POST", body: { businessProfile: profile, businessSituation } }, response);
  return response;
}

test("current recommendation capabilities accept empty requiredInput", async () => {
  assert.equal((await call(recommendations())).statusCode, 200);
});

test("a genuinely missing registered capability input is accepted", async () => {
  const registry = registryWithFullRequiredInputs(["campaignBudget"]);
  const response = await call(recommendations(["campaignBudget"]), "", registry);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(response.body.recommendations[0].requiredInput)), ["campaignBudget"]);
});

test("requiredInput cannot ask again for information already supplied in Business Situation", async () => {
  const registry = registryWithFullRequiredInputs(["campaignBudget"]);
  assert.equal((await call(recommendations(["campaignBudget"]), "Our campaign budget is 500 pounds.", registry)).statusCode, 502);
  assert.equal((await call(recommendations([]), "Our campaign budget is 500 pounds.", registry)).statusCode, 200);
});

test("requiredInput cannot ask again for a registered input already in the Business Manager Profile", async () => {
  const registry = registryWithFullRequiredInputs(["location"]);
  assert.equal((await call(recommendations(["location"]), "", registry)).statusCode, 502);
  assert.equal((await call(recommendations([]), "", registry)).statusCode, 200);
});

test("requiredInput remains bounded and string-only", async () => {
  const registry = registryWithFullRequiredInputs(["campaignBudget"]);
  for (const value of ["campaignBudget", [42], [""], ["x".repeat(161)],
    ["campaignBudget", "a", "b", "c", "d", "e"]]) {
    const output = recommendations(); output.recommendations[0].requiredInput = value;
    assert.equal((await call(output, "", registry)).statusCode, 502);
  }
});
