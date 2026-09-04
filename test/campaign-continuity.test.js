const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createCampaignContinuity,
  getCampaignContinuity,
  getCampaignContinuityLabel
} = require("../js/script.js");

test("an original progresses through Revision 1 and Revision 2", function () {
  const original = {
    id: "campaign-original",
    ...createCampaignContinuity("campaign-original")
  };
  const revisionOne = {
    id: "campaign-revision-1",
    ...createCampaignContinuity("campaign-revision-1", original)
  };
  const revisionTwo = {
    id: "campaign-revision-2",
    ...createCampaignContinuity("campaign-revision-2", revisionOne)
  };

  assert.equal(getCampaignContinuityLabel(original), "Original");
  assert.equal(getCampaignContinuityLabel(revisionOne), "Revision 1");
  assert.equal(getCampaignContinuityLabel(revisionTwo), "Revision 2");
  assert.equal(revisionOne.originalMarketingWorkId, original.id);
  assert.equal(revisionTwo.originalMarketingWorkId, original.id);
});

test("creating a revision does not change the source version approval", function () {
  const approvedOriginal = {
    id: "approved-original",
    approvalStatus: "Approved",
    ...createCampaignContinuity("approved-original")
  };

  const revision = createCampaignContinuity("new-revision", approvedOriginal);

  assert.equal(approvedOriginal.approvalStatus, "Approved");
  assert.equal(revision.revisionNumber, 1);
});

test("a legacy campaign without continuity data opens as an Original", function () {
  const legacyCampaign = {
    id: "legacy-campaign",
    campaignText: "Legacy campaign content",
    approvalStatus: "Approved"
  };

  assert.deepEqual(getCampaignContinuity(legacyCampaign), {
    originalMarketingWorkId: "legacy-campaign",
    revisionNumber: 0
  });
  assert.equal(getCampaignContinuityLabel(legacyCampaign), "Original");
  assert.equal(legacyCampaign.campaignText, "Legacy campaign content");
  assert.equal(legacyCampaign.approvalStatus, "Approved");
});
