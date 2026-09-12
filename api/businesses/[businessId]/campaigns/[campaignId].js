const { getRepository } = require("../../../_lib/persistence.js");
const {
  authorizeBusinessOwnerRequest
} = require("../../../_lib/demeos-business-owner-authorization.js");
const { DEMEOS_ACTIONS } = require("../../../_lib/demeos-rules.js");
const {
  getCapabilityForRecommendationType
} = require("../../../_lib/capability-registry.js");

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  const campaign = req.body && req.body.campaign;
  if (!businessId || !campaignId) {
    return res.status(400).json({ error: "A businessId, campaignId, and campaign are required." });
  }

  try {
    const repository = getRepository();
    const isApprovalRequest = campaign && campaign.approvalStatus === "Approved";
    const access = await authorizeBusinessOwnerRequest({
      req,
      businessId,
      action: isApprovalRequest
        ? DEMEOS_ACTIONS.APPROVE_OWN_MARKETING
        : DEMEOS_ACTIONS.CREATE_MARKETING,
      repository
    });
    if (!access.authenticated) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const requiredCampaignFields = [
      "campaignText",
      "campaignType",
      "campaignTypeLabel",
      "businessName",
      "createdAt",
      "approvalStatus"
    ];
    const isCampaignObject = campaign && typeof campaign === "object" && !Array.isArray(campaign);
    const hasInvalidCampaignField = !isCampaignObject || requiredCampaignFields.some(function (field) {
      return typeof campaign[field] !== "string" || !campaign[field].trim();
    });
    const campaignCapability = isCampaignObject
      ? getCapabilityForRecommendationType(campaign.campaignType)
      : null;
    if (
      hasInvalidCampaignField ||
      !["Unapproved", "Approved"].includes(campaign.approvalStatus) ||
      !campaignCapability ||
      !campaignCapability.available ||
      campaignCapability.supportedOutputType !== campaign.campaignType
    ) {
      return res.status(400).json({ error: "DEMEOS received invalid campaign data." });
    }

    if (isApprovalRequest) {
      let approvedCampaign = await repository.approveCampaign(businessId, campaignId);
      if (!approvedCampaign) {
        const createAccess = await authorizeBusinessOwnerRequest({
          req,
          businessId,
          action: DEMEOS_ACTIONS.CREATE_MARKETING,
          repository
        });
        if (!createAccess.authenticated) {
          return res.status(401).json({ error: "Authentication required." });
        }
        if (!createAccess.allowed) {
          return res.status(403).json({ error: "Forbidden." });
        }

        const restoredCampaign = await repository.saveCampaign({
          ...campaign,
          id: campaignId,
          businessId,
          approvalStatus: "Unapproved"
        });
        if (restoredCampaign) {
          approvedCampaign = await repository.approveCampaign(businessId, campaignId);
        }
      }
      if (!approvedCampaign) {
        return res.status(404).json({ error: "Campaign was not found for this business." });
      }
    } else {
      const savedCampaign = await repository.saveCampaign({ ...campaign, id: campaignId, businessId });
      if (!savedCampaign) {
        return res.status(409).json({ error: "Campaign could not be saved for this business." });
      }
    }
    return res.status(204).end();
  } catch (error) {
    console.error("Could not persist campaign:", error);
    return res.status(500).json({ error: "DEMEOS could not persist this campaign." });
  }
};
