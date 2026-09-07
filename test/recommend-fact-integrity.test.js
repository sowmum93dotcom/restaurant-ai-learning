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

function recommendation(title, reason, request, type, capability, expectedOutcome) {
  return {
    title,
    reason,
    targetCustomer: profile.targetCustomer,
    businessObjective: `${profile.goal} by addressing quiet Tuesday evenings`,
    demeosCapability: capability,
    suggestedRequest: request,
    suggestedCampaignType: type,
    evidence: [
      { source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" },
      { source: "businessSituation", field: "businessSituation", value: situation, verificationState: "ownerProvided" }
    ],
    expectedOutcome,
    requiredInput: [],
    approvalState: "pending"
  };
}

async function call(output) {
  const context = {
    module: { exports: {} },
    process: { env: { OPENAI_API_KEY: "key" } },
    console,
    require(id) {
      return id === "./_lib/capability-registry.js"
        ? require("../api/_lib/capability-registry.js")
        : require(id);
    },
    fetch: async () => ({
      ok: true,
      headers: { get() { return null; } },
      async text() { return JSON.stringify({ output_text: JSON.stringify(output) }); }
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
  await context.module.exports({ method: "POST", body: { businessProfile: profile, businessSituation: situation } }, response);
  return response;
}

function validThree(first) {
  return {
    recommendations: [
      first,
      recommendation(
        "Tuesday Evening Social Awareness",
        "Create social messaging about Mamma Pizza and quiet Tuesday evenings for the verified target customer.",
        "Create a social media campaign for Mamma Pizza focused on quiet Tuesday evenings and attracting more local customers.",
        "social",
        "Social Media Campaign",
        `This social campaign aims to support ${profile.goal} by encouraging customer interest in visiting on Tuesday evenings.`
      ),
      recommendation(
        "Tuesday Evening Email Awareness",
        "Create an email campaign about Mamma Pizza and quiet Tuesday evenings for the verified target customer.",
        "Create an email campaign for Mamma Pizza focused on quiet Tuesday evenings and attracting more local customers.",
        "email",
        "Email Campaign",
        `This email campaign aims to support ${profile.goal} by encouraging customer interest in visiting on Tuesday evenings.`
      )
    ]
  };
}

test("Mamma Pizza scenario rejects invented existing Tuesday specials or offers", async () => {
  const invented = recommendation(
    "Tuesday Evening Family Specials Campaign",
    "Create a campaign centered on Tuesday evening specials and appealing offers for local families and office workers.",
    "Promote Mamma Pizza's Tuesday evening specials and offers.",
    "full",
    "Full Marketing Campaign",
    `This campaign aims to support ${profile.goal} by attracting families and office workers to Tuesday evening specials.`
  );
  const response = await call(validThree(invented));
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.recommendations, undefined);
});

test("a later unrelated create action cannot validate an earlier invented special", async () => {
  const invented = recommendation(
    "Engaging Tuesday Evening Social Posts",
    "Use social media to highlight Tuesday evening specials and create community engagement with warm, welcoming content.",
    "Create social posts about Tuesday evening visits for Mamma Pizza.",
    "social",
    "Social Media Campaign",
    `This social campaign aims to support ${profile.goal} by encouraging customer interest in Tuesday evening visits.`
  );
  const response = await call(validThree(invented));
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.recommendations, undefined);
});

test("a clearly proposed new offer remains allowed when it is not presented as existing", async () => {
  const proposed = recommendation(
    "Explore a Tuesday Evening Offer",
    "Explore creating a new Tuesday evening offer as a possible marketing idea for the verified target customer.",
    "Create a full marketing campaign that proposes testing a new Tuesday evening offer; do not state that an offer already exists.",
    "full",
    "Full Marketing Campaign",
    `This campaign aims to support ${profile.goal} by testing whether a newly proposed offer may encourage customer interest.`
  );
  const response = await call(validThree(proposed));
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.recommendations.length, 3);
});

test("an explicitly supplied owner offer can be referenced as an existing fact", async () => {
  const ownerSituation = "Tuesday evenings are quiet and we already offer a family pizza deal on Tuesdays.";
  const output = {
    recommendations: [
      {
        ...recommendation(
          "Promote the Existing Tuesday Family Deal",
          "Promote the family pizza deal that the owner explicitly supplied.",
          "Create a full campaign promoting the existing Tuesday family pizza deal.",
          "full",
          "Full Marketing Campaign",
          `This campaign aims to support ${profile.goal} by encouraging customer interest in the supplied Tuesday family pizza deal.`
        ),
        evidence: [
          { source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" },
          { source: "businessSituation", field: "businessSituation", value: ownerSituation, verificationState: "ownerProvided" }
        ]
      },
      {
        ...recommendation(
          "Tuesday Social",
          "Create social messaging about the supplied family pizza deal.",
          "Create a social campaign about the supplied family pizza deal.",
          "social",
          "Social Media Campaign",
          `This social campaign aims to support ${profile.goal} by encouraging customer interest in the supplied family pizza deal.`
        ),
        evidence: [
          { source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" },
          { source: "businessSituation", field: "businessSituation", value: ownerSituation, verificationState: "ownerProvided" }
        ]
      },
      {
        ...recommendation(
          "Tuesday Email",
          "Create email messaging about the supplied family pizza deal.",
          "Create an email campaign about the supplied family pizza deal.",
          "email",
          "Email Campaign",
          `This email campaign aims to support ${profile.goal} by encouraging customer interest in the supplied family pizza deal.`
        ),
        evidence: [
          { source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" },
          { source: "businessSituation", field: "businessSituation", value: ownerSituation, verificationState: "ownerProvided" }
        ]
      }
    ]
  };

  const context = {
    module: { exports: {} }, process: { env: { OPENAI_API_KEY: "key" } }, console,
    require(id) { return id === "./_lib/capability-registry.js" ? require("../api/_lib/capability-registry.js") : require(id); },
    fetch: async () => ({ ok: true, headers: { get() { return null; } }, async text() {
      return JSON.stringify({ output_text: JSON.stringify(output) });
    } })
  };
  vm.runInNewContext(source, context);
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  await context.module.exports({ method: "POST", body: { businessProfile: profile, businessSituation: ownerSituation } }, response);
  assert.equal(response.statusCode, 200);
});
