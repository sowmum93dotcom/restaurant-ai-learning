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

function recommendation(title, reason, request, situation, type = "full", capability = "Full Marketing Campaign") {
  return {
    title,
    reason,
    targetCustomer: profile.targetCustomer,
    businessObjective: `${profile.goal} by addressing the owner-provided business situation`,
    demeosCapability: capability,
    suggestedRequest: request,
    suggestedCampaignType: type,
    evidence: [
      { source: "businessProfile", field: "goal", value: profile.goal, verificationState: "verified" },
      { source: "businessSituation", field: "businessSituation", value: situation, verificationState: "ownerProvided" }
    ],
    expectedOutcome: `This campaign aims to support ${profile.goal} by encouraging customer interest.`,
    requiredInput: [],
    approvalState: "pending"
  };
}

function validThree(first, situation) {
  return {
    recommendations: [
      first,
      recommendation(
        "Local Social Awareness",
        "Create social messaging grounded only in the verified profile and owner-provided situation.",
        "Create a social media campaign grounded only in the verified profile and owner-provided situation.",
        situation,
        "social",
        "Social Media Campaign"
      ),
      recommendation(
        "Local Email Awareness",
        "Create email messaging grounded only in the verified profile and owner-provided situation.",
        "Create an email campaign grounded only in the verified profile and owner-provided situation.",
        situation,
        "email",
        "Email Campaign"
      )
    ]
  };
}

async function call(output, businessSituation) {
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
  await context.module.exports({ method: "POST", body: { businessProfile: profile, businessSituation } }, response);
  return response;
}

test("forbidden premise classes are rejected when the owner never supplied them", async () => {
  const situation = "Tuesday evenings are quiet and I would like to attract more local customers.";
  const claims = [
    "our existing Tuesday promotion",
    "our existing delivery service",
    "our existing customer testimonial",
    "our existing customer list",
    "our existing performance results",
    "our existing booking levels",
    "our existing sales figures",
    "our existing opening hours"
  ];

  for (const claim of claims) {
    const invented = recommendation(
      `Promote ${claim}`,
      `Use ${claim} to attract more local customers.`,
      `Create a campaign promoting ${claim}.`,
      situation
    );
    const response = await call(validThree(invented, situation), situation);
    assert.equal(response.statusCode, 502, `expected unsupported premise to be rejected: ${claim}`);
  }
});

test("the exact Mamma Pizza Tuesday failure wording is rejected", async () => {
  const situation = "Tuesday evenings are quiet and I would like to attract more local customers.";
  const failures = [
    [
      "Promote Tuesday Evening Special Offers to Local Customers",
      "To address the quiet Tuesday evenings, create a campaign highlighting special offers or menu items specifically available on Tuesdays to attract local families and office workers in Lewisham.",
      "Create a full marketing campaign highlighting Tuesday evening special offers or menu items."
    ],
    [
      "Engage Locals with Tuesday Specials on Social Media",
      "Use social media posts to create awareness and excitement about Tuesday night dining with special offerings.",
      "Create social media content promoting Tuesday specials and special offerings."
    ],
    [
      "Send Targeted Email Campaign Highlighting Tuesday Offers",
      "Create personalized messages promoting Tuesday evening deals to boost weekday bookings and encourage repeat visits.",
      "Create an email campaign highlighting Tuesday offers, deals and promotions."
    ]
  ];

  for (const [title, reason, request] of failures) {
    const response = await call(validThree(recommendation(title, reason, request, situation), situation), situation);
    assert.equal(response.statusCode, 502, `expected live invented-asset wording to be rejected: ${title}`);
  }
});

test("the Tuesday situation accepts marketing that uses only supplied facts", async () => {
  const situation = "Tuesday evenings are quiet and I would like to attract more local customers.";
  const grounded = recommendation(
    "Reach Local Customers on Quiet Tuesday Evenings",
    "Create a campaign inviting local customers to consider visiting on Tuesday evenings, using only the owner-provided fact that Tuesday evenings are quiet.",
    "Create a full marketing campaign for local customers focused on Tuesday evenings and the verified business goal, without adding offers, products, events or other unsupplied business facts.",
    situation
  );
  const response = await call(validThree(grounded, situation), situation);
  assert.equal(response.statusCode, 200);
});

test("a clearly proposed new Tuesday offer can be suggested without claiming it already exists", async () => {
  const situation = "Tuesday evenings are quiet and I would like to attract more local customers.";
  const proposed = recommendation(
    "Consider Creating a New Tuesday Offer",
    "Consider creating a new Tuesday offer for owner approval rather than claiming an existing Tuesday offer.",
    "Create a campaign concept that proposes creating a new Tuesday offer for owner approval.",
    situation
  );
  const response = await call(validThree(proposed, situation), situation);
  assert.equal(response.statusCode, 200);
});

test("a Friday deal does not authorize a recommendation claiming a Tuesday deal", async () => {
  const situation = "We have a family pizza deal on Fridays and Tuesday evenings are quiet.";
  const invented = recommendation(
    "Promote the Existing Tuesday Deal",
    "Promote the existing Tuesday family pizza deal to local customers.",
    "Create a campaign promoting the existing Tuesday family pizza deal.",
    situation
  );
  const response = await call(validThree(invented, situation), situation);
  assert.equal(response.statusCode, 502);
});

test("a negated owner mention does not authorize an existing asset claim", async () => {
  const situation = "Tuesday evenings are quiet and we do not offer any deals.";
  const invented = recommendation(
    "Promote the Existing Tuesday Deal",
    "Promote the existing Tuesday deal to local customers.",
    "Create a campaign promoting the existing Tuesday deal.",
    situation
  );
  const response = await call(validThree(invented, situation), situation);
  assert.equal(response.statusCode, 502);
});

test("an owner-supplied qualified deal can still be referenced with the same qualifiers", async () => {
  const situation = "We already offer a family pizza deal on Tuesdays and want more local customers.";
  const supplied = recommendation(
    "Promote the Existing Tuesday Family Pizza Deal",
    "Promote the existing Tuesday family pizza deal that the owner supplied.",
    "Create a campaign promoting the existing Tuesday family pizza deal.",
    situation
  );
  const response = await call(validThree(supplied, situation), situation);
  assert.equal(response.statusCode, 200);
});
