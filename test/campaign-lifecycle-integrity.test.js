const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const { canPublishToDemeosCustomerExperience } = require("../api/_lib/customer-publication-rules.js");

function campaign(overrides) {
  return {
    campaignType: "social",
    campaignText: "A genuine customer-facing message.",
    approvalStatus: "Approved",
    ...overrides
  };
}

test("current publication requires current owner approval", function () {
  assert.equal(canPublishToDemeosCustomerExperience(campaign()), true);
  assert.equal(canPublishToDemeosCustomerExperience(campaign({ approvalStatus: "Unapproved" })), false);
});

test("withdrawal reuses the existing Unapproved lifecycle instead of inventing expiry", function () {
  const source = fs.readFileSync(path.join(__dirname,
    "../api/businesses/[businessId]/campaigns/[campaignId].js"), "utf8");
  assert.match(source, /action !== "withdraw" && action !== "reactivate"/);
  assert.match(source, /approvalStatus: "Unapproved"/);
  assert.doesNotMatch(source, /expiresAt|expiryScore|decayScore|performanceScore|confidencePercentage/);
});

test("lifecycle changes remain server-authorized and business-scoped", function () {
  const source = fs.readFileSync(path.join(__dirname,
    "../api/businesses/[businessId]/campaigns/[campaignId].js"), "utf8");
  assert.match(source, /authorizeBusinessOwnerRequest/);
  assert.match(source, /businessId,/);
  assert.match(source, /existing\.businessId !== businessId/);
  assert.match(source, /DEMEOS_ACTIONS\.APPROVE_OWN_MARKETING/);
});

test("reactivation fails closed when current work is not publishable material", function () {
  const source = fs.readFileSync(path.join(__dirname,
    "../api/businesses/[businessId]/campaigns/[campaignId].js"), "utf8");
  assert.match(source, /Campaign is not eligible for reactivation/);
  assert.match(source, /approvalStatus: "Unapproved"/);
});

test("historical issuance is not deleted by lifecycle route", function () {
  const source = fs.readFileSync(path.join(__dirname,
    "../api/businesses/[businessId]/campaigns/[campaignId].js"), "utf8");
  assert.doesNotMatch(source, /DELETE FROM demeos_customer_possibility_issuances/i);
  assert.doesNotMatch(source, /DELETE FROM demeos_customer_feedback/i);
  assert.doesNotMatch(source, /DELETE FROM demeos_customer_participation/i);
});
