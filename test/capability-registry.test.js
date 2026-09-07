const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getCapabilities, getRecommendationCapabilities, getCapabilityForRecommendationType
} = require("../api/_lib/capability-registry.js");

test("full, social, and email are the available recommendation campaign capabilities", () => {
  const recommendationCapabilities = getRecommendationCapabilities();
  assert.deepEqual(recommendationCapabilities.map((capability) => capability.supportedOutputType),
    ["full", "social", "email"]);
  assert.ok(recommendationCapabilities.every((capability) => capability.available));
  assert.deepEqual(recommendationCapabilities.map((capability) => capability.ownerFacingName),
    ["Full Marketing Campaign", "Social Media Campaign", "Email Campaign"]);
});

test("Campaign Revision is available without becoming a new recommendation campaign type", () => {
  const revision = getCapabilities().find((capability) => capability.id === "campaign-revision");
  assert.equal(revision.ownerFacingName, "Campaign Revision");
  assert.equal(revision.available, true);
  assert.equal(revision.recommendationCampaignType, false);
  assert.equal(revision.supportedOutputType, null);
  assert.equal(getRecommendationCapabilities().includes(revision), false);
});

test("video, loyalty programme, and automatic publishing are explicitly unavailable", () => {
  const unavailable = getCapabilities().filter((capability) => !capability.available);
  assert.deepEqual(unavailable.map((capability) => capability.ownerFacingName),
    ["Create Video", "Launch Loyalty Programme", "Automatic Publishing"]);
  assert.ok(unavailable.every((capability) => capability.recommendationCampaignType === false));
});

test("every capability has the registry's required structured metadata", () => {
  for (const capability of getCapabilities()) {
    assert.equal(typeof capability.id, "string");
    assert.equal(typeof capability.ownerFacingName, "string");
    assert.equal(typeof capability.available, "boolean");
    assert.ok(Array.isArray(capability.constraints));
    assert.ok(Array.isArray(capability.requiredInputs));
    assert.ok(Array.isArray(capability.approvalRequirements));
    assert.ok(capability.supportedOutputType === null || typeof capability.supportedOutputType === "string");
  }
  assert.equal(getCapabilityForRecommendationType("video"), null);
  assert.equal(getCapabilityForRecommendationType("not-registered"), null);
});
