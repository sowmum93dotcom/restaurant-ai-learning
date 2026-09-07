const capabilities = Object.freeze([
  {
    id: "marketing-campaign-full",
    ownerFacingName: "Full Marketing Campaign",
    available: true,
    constraints: ["Produces the existing complete campaign format"],
    requiredInputs: ["businessProfile", "marketingRequest"],
    approvalRequirements: ["ownerApprovalBeforeUse"],
    supportedOutputType: "full",
    recommendationCampaignType: true
  },
  {
    id: "social-content",
    ownerFacingName: "Social Media Campaign",
    available: true,
    constraints: ["Produces social content only", "Does not publish automatically"],
    requiredInputs: ["businessProfile", "marketingRequest"],
    approvalRequirements: ["ownerApprovalBeforeUse", "ownerPublishesManually"],
    supportedOutputType: "social",
    recommendationCampaignType: true
  },
  {
    id: "email-campaign",
    ownerFacingName: "Email Campaign",
    available: true,
    constraints: ["Produces email content only", "Does not send automatically"],
    requiredInputs: ["businessProfile", "marketingRequest"],
    approvalRequirements: ["ownerApprovalBeforeUse", "ownerSendsManually"],
    supportedOutputType: "email",
    recommendationCampaignType: true
  },
  {
    id: "campaign-revision",
    ownerFacingName: "Campaign Revision",
    available: true,
    constraints: ["Revises an existing Campaign Workspace campaign", "Not a new recommendation campaign type"],
    requiredInputs: ["existingCampaign", "revisionInstruction"],
    approvalRequirements: ["ownerApprovalBeforeUse"],
    supportedOutputType: null,
    recommendationCampaignType: false
  },
  {
    id: "create-video",
    ownerFacingName: "Create Video",
    available: false,
    constraints: ["Video creation is not implemented"],
    requiredInputs: [],
    approvalRequirements: [],
    supportedOutputType: null,
    recommendationCampaignType: false
  },
  {
    id: "launch-loyalty-programme",
    ownerFacingName: "Launch Loyalty Programme",
    available: false,
    constraints: ["Loyalty programme execution is not implemented"],
    requiredInputs: [],
    approvalRequirements: [],
    supportedOutputType: null,
    recommendationCampaignType: false
  },
  {
    id: "automatic-publishing",
    ownerFacingName: "Automatic Publishing",
    available: false,
    constraints: ["Publishing integrations are not implemented"],
    requiredInputs: [],
    approvalRequirements: [],
    supportedOutputType: null,
    recommendationCampaignType: false
  }
].map(Object.freeze));

function getCapabilities() {
  return capabilities;
}

function getRecommendationCapabilities() {
  return capabilities.filter(function (capability) {
    return capability.available && capability.recommendationCampaignType && capability.supportedOutputType;
  });
}

function getCapabilityForRecommendationType(type) {
  return getRecommendationCapabilities().find(function (capability) {
    return capability.supportedOutputType === type;
  }) || null;
}

module.exports = { getCapabilities, getRecommendationCapabilities, getCapabilityForRecommendationType };
