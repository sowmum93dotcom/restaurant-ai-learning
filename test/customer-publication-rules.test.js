const assert = require("node:assert/strict");
const test = require("node:test");

const { getCapabilities } = require("../api/_lib/capability-registry.js");
const {
  canPublishToDemeosCustomerExperience
} = require("../api/_lib/customer-publication-rules.js");
const { createPersistenceRepository } = require("../api/_lib/persistence.js");

const validFullCampaignText = `CAMPAIGN STRATEGY
Reach local diners
SOCIAL MEDIA POST
Join us this weekend
EMAIL CAMPAIGN
An owner-sent email
SHORT AD COPY
Fresh food nearby
CALL TO ACTION
Visit us`;

test("approved supported campaigns with customer-facing content are eligible", function () {
  assert.equal(canPublishToDemeosCustomerExperience({
    campaignType: "full", campaignText: validFullCampaignText, approvalStatus: "Approved"
  }), true);
  assert.equal(canPublishToDemeosCustomerExperience({
    campaignType: "social", campaignText: "Join us this weekend", approvalStatus: "Approved"
  }), true);
  assert.equal(canPublishToDemeosCustomerExperience({
    campaignType: "email", campaignText: "News from your local restaurant", approvalStatus: "Approved"
  }), true);
});

test("unapproved, malformed, unsupported, empty, and missing campaigns are ineligible", function () {
  assert.equal(canPublishToDemeosCustomerExperience({
    campaignType: "social", campaignText: "Draft post", approvalStatus: "Unapproved"
  }), false);
  assert.equal(canPublishToDemeosCustomerExperience({
    campaignType: "social", campaignText: "Revised draft", approvalStatus: "Pending Approval"
  }), false);
  assert.equal(canPublishToDemeosCustomerExperience({
    campaignType: "full", campaignText: "CAMPAIGN STRATEGY\nMissing sections", approvalStatus: "Approved"
  }), false);
  assert.equal(canPublishToDemeosCustomerExperience({
    campaignType: "video", campaignText: "A video", approvalStatus: "Approved"
  }), false);
  assert.equal(canPublishToDemeosCustomerExperience({
    campaignType: "email", campaignText: "   ", approvalStatus: "Approved"
  }), false);
  assert.equal(canPublishToDemeosCustomerExperience(null), false);
});

test("participation is not recorded when the campaign fails the publication rule", async function () {
  const statements = [];
  const repository = createPersistenceRepository({
    async ensureSchema() {},
    async query(statement) {
      statements.push(statement);
      return { rows: [{ campaign: {
        campaignType: "video", campaignText: "Not a supported output", approvalStatus: "Approved"
      } }] };
    }
  });

  const participation = await repository.recordCustomerParticipation("campaign-a", "Interested");

  assert.equal(participation, null);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /^SELECT business_id, campaign/);
});

test("internal publication does not make automatic or external publishing available", function () {
  const automaticPublishing = getCapabilities().find(function (capability) {
    return capability.id === "automatic-publishing";
  });

  assert.equal(automaticPublishing.available, false);
  assert.equal(automaticPublishing.supportedOutputType, null);
  assert.deepEqual(automaticPublishing.constraints, ["Publishing integrations are not implemented"]);
  assert.equal(getCapabilities().some(function (capability) {
    return capability.available && /publish|send/i.test(capability.ownerFacingName);
  }), false);
});
