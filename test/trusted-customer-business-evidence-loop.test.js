const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const persistence = require("../api/_lib/persistence.js");
const customerAuth = require("../api/_lib/demeos-customer-authentication.js");
const issuanceTrust = require("../api/_lib/customer-possibility-issuance-trust.js");

function response() {
  return { statusCode: null, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function callCommonJs(path, request, repository) {
  const oldRepository = persistence.getRepository;
  persistence.getRepository = function () { return repository; };
  delete require.cache[require.resolve(path)];
  try {
    const res = response();
    await require(path)(request, res);
    return res;
  } finally {
    persistence.getRepository = oldRepository;
    delete require.cache[require.resolve(path)];
  }
}

function recommendation(title, type, capability, profile, evidence = []) {
  return { title, reason: "Use only the recorded interest and relevance signals as bounded learning context.",
    targetCustomer: profile.targetCustomer, businessObjective: `${profile.goal} with a new approved message`,
    demeosCapability: capability, suggestedRequest: `Create a ${type} campaign using only verified profile facts.`,
    suggestedCampaignType: type,
    evidence: [{ source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" }, ...evidence],
    expectedOutcome: `Aims to support ${profile.goal} and may encourage customer interest.`, requiredInput: [], approvalState: "pending" };
}

test("approved work completes the trusted customer-to-business recommendation evidence loop without semantic inflation", async function () {
  const oldAuth = customerAuth.resolveTrustedCustomerIdentityFromRequest;
  const oldPrepare = issuanceTrust.prepareCustomerPossibilityIssuanceTrust;
  const oldConfirm = issuanceTrust.confirmCustomerPossibilityIssuanceDelivery;
  const customerId = "customer-trusted";
  const businessId = "business-a";
  const campaignId = "campaign-approved";
  const timestamp = "2026-09-16T10:00:00.000Z";
  const campaign = { id: campaignId, businessId, campaignType: "social", campaignText: "Relaxed family dinner tonight",
    approvalStatus: "Approved" };
  const publicWork = { workItemId: campaignId, businessName: "North Star", location: "Leeds",
    content: campaign.campaignText, participationAction: "Interested" };
  const state = { issued: new Set(), participation: [], feedback: [] };
  const repository = {
    async getCustomerWork() { return [publicWork]; }, async getOwnedBusinessIds() { return []; },
    async getCustomerPrivacyControls() { return { usePreferencesAsGuidance: false, useFeedbackAsGuidance: false }; },
    async recordCustomerPossibilityIssuance(owner, possibilities) {
      assert.equal(owner, customerId);
      possibilities.forEach((item) => { if (item.workItemId === campaignId) state.issued.add(item.workItemId); });
      return [...state.issued];
    },
    async recordCustomerParticipation(workItemId, action, owner) {
      if (!state.issued.has(workItemId) || owner !== customerId || action !== "Interested") return null;
      const item = { business_id: businessId, campaign_id: workItemId, action,
        evidence_type: "customer-participation", source: "customer-interested-action", participated_at: timestamp };
      state.participation.push(item); return item;
    },
    async recordCustomerFeedback(workItemId, feedback, owner) {
      if (!state.issued.has(workItemId) || owner !== customerId || feedback.feedbackType !== "possibility-relevance") return null;
      state.feedback.push({ ...feedback, campaignId: workItemId, businessId, owner, createdAt: timestamp });
      return { response: feedback.response };
    }
  };
  customerAuth.resolveTrustedCustomerIdentityFromRequest = async function () {
    return { trustedCustomerIdentityId: customerId, provider: "clerk" };
  };
  issuanceTrust.prepareCustomerPossibilityIssuanceTrust = async function () {};
  issuanceTrust.confirmCustomerPossibilityIssuanceDelivery = async function (_owner, ids) { return ids; };

  try {
    const possibility = await callCommonJs("../api/customer/possibilities.js", {
      method: "POST", body: { understanding: { intention: "Eat & enjoy", customerText: "relaxed family dinner",
        understanding: "You’d like to eat and enjoy and are looking for relaxed family dinner.",
        source: "customer-provided", confidenceState: "confirmed" } }
    }, repository);
    assert.equal(possibility.statusCode, 200);
    assert.deepEqual(possibility.body.possibilities.map((item) => item.workItemId), [campaignId]);
    assert.equal(state.issued.has(campaignId), true);

    const interested = await callCommonJs("../api/customer/work/[campaignId]/participation.js",
      { method: "POST", query: { campaignId }, body: { action: "Interested", businessId: "spoofed" } }, repository);
    assert.equal(interested.statusCode, 201);
    const feedback = await callCommonJs("../api/customer/work/[campaignId]/participation.js",
      { method: "POST", query: { campaignId, interaction: "feedback" },
        body: { response: "Relevant", comment: "This fits" } }, repository);
    assert.equal(feedback.statusCode, 201);
    assert.equal(state.participation[0].campaign_id, campaignId);
    assert.equal(state.participation[0].evidence_type, "customer-participation");
    assert.equal(state.feedback[0].feedbackType, "possibility-relevance");
    assert.equal(state.feedback[0].owner, customerId);

    const profile = { name: "North Star", type: "Cafe", location: "Leeds", brandVoice: "Warm",
      targetCustomer: "Local families", goal: "Build awareness" };
    const businessRecord = { businessProfile: { ...profile, businessId }, campaigns: [campaign], recommendationDecisions: [],
      customerParticipationResults: [{ workItemId: campaignId, businessId, name: campaign.campaignText,
        customerInterestCount: 1, latestParticipationAt: timestamp,
        evidenceType: "customer-participation", source: "customer-interested-action" }],
      customerFeedbackResults: [{ workItemId: campaignId, businessId, relevantCount: 1, notQuiteCount: 0,
        somethingDifferentCount: 0, latestFeedbackAt: timestamp,
        evidenceType: "customer-feedback", source: "customer-feedback-action" }] };
    const output = { recommendations: [
      recommendation("One", "full", "Full Marketing Campaign", profile, [
        { source: "customerParticipation", field: "workItemId", value: campaignId, verificationState: "systemRecordedInterest" }]),
      recommendation("Two", "social", "Social Media Campaign", profile, [
        { source: "customerFeedback", field: "relevantCount", value: "1", verificationState: "systemRecordedFeedback" }]),
      recommendation("Three", "email", "Email Campaign", profile)
    ] };
    const source = fs.readFileSync(require.resolve("../api/recommend.js"), "utf8")
      .replace("export default async function handler", "module.exports = async function handler");
    let prompt;
    const context = { module: { exports: {} }, process: { env: { OPENAI_API_KEY: "key" } }, console,
      require(id) {
        if (id === "../api/_lib/persistence.js") return { getRepository: () => ({ getKnownBusiness: async () => businessRecord }) };
        if (id === "../api/_lib/demeos-business-owner-authorization.js") return { authorizeBusinessOwnerRequest: async () => ({ authenticated: true, allowed: true }) };
        if (id === "../api/_lib/demeos-rules.js") return require("../api/_lib/demeos-rules.js");
        if (id === "./_lib/capability-registry.js") return require("../api/_lib/capability-registry.js");
        if (id === "./_lib/campaign-outcome-contract.js") return require("../api/_lib/campaign-outcome-contract.js");
        return require(id);
      }, fetch: async (_url, options) => { prompt = JSON.parse(options.body).input; return { ok: true,
        headers: { get() { return null; } }, async text() { return JSON.stringify({ output_text: JSON.stringify(output) }); } }; } };
    vm.runInNewContext(source, context);
    const recommends = response();
    await context.module.exports({ method: "POST", body: { businessId, businessSituation: "",
      customerInterestCount: 999, feedback: "browser inflation" } }, recommends);
    assert.equal(recommends.statusCode, 200);
    assert.match(prompt, /"evidenceType":"customer-participation"/);
    assert.match(prompt, /"evidenceType":"customer-feedback"/);
    assert.match(prompt, new RegExp(timestamp));
    assert.doesNotMatch(prompt, /999|browser inflation/);
    const claims = recommends.body.recommendations.flatMap((item) => [item.title, item.reason,
      item.businessObjective, item.suggestedRequest, item.expectedOutcome]).join(" ");
    assert.doesNotMatch(claims, /sale|purchase|booking|conversion|success|performance|demand|availability|price|discount|commitment|preference/i);
    assert.equal(Object.hasOwn(campaign, "outcome"), false, "customer evidence must not create an owner outcome");
  } finally {
    customerAuth.resolveTrustedCustomerIdentityFromRequest = oldAuth;
    issuanceTrust.prepareCustomerPossibilityIssuanceTrust = oldPrepare;
    issuanceTrust.confirmCustomerPossibilityIssuanceDelivery = oldConfirm;
  }
});
