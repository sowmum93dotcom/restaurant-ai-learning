const { getRepository } = require("../../../_lib/persistence.js");
const {
  authorizeBusinessOwnerRequest
} = require("../../../_lib/demeos-business-owner-authorization.js");
const { DEMEOS_ACTIONS } = require("../../../_lib/demeos-rules.js");
const { normalizeMarketingMediaLinks } = require("../../../_lib/marketing-media-link.js");
const {
  getCapabilityForRecommendationType
} = require("../../../_lib/capability-registry.js");

function findCampaign(record, campaignId) {
  const campaigns = record && Array.isArray(record.campaigns) ? record.campaigns : [];
  return campaigns.find(function (campaign) { return campaign && campaign.id === campaignId; }) || null;
}

async function handleLifecycleChange(req, res, repository, businessId, campaignId) {
  const action = req.body && req.body.action;
  if (action !== "withdraw" && action !== "reactivate") {
    return res.status(400).json({ error: "A supported lifecycle action is required." });
  }

  const access = await authorizeBusinessOwnerRequest({
    req,
    businessId,
    action: action === "reactivate" ? DEMEOS_ACTIONS.APPROVE_OWN_MARKETING : DEMEOS_ACTIONS.CREATE_MARKETING,
    repository
  });
  if (!access.authenticated) return res.status(401).json({ error: "Authentication required." });
  if (!access.allowed) return res.status(403).json({ error: "Forbidden." });

  const record = await repository.getKnownBusiness(businessId);
  const existing = findCampaign(record, campaignId);
  if (!existing || existing.businessId !== businessId) {
    return res.status(404).json({ error: "Campaign was not found for this business." });
  }

  if (action === "withdraw") {
    // DEMEOS already uses Unapproved as the non-publishable state. Reuse that
    // lifecycle instead of inventing a parallel archive/expiry system. Historical
    // issuance, participation, feedback and outcomes remain stored independently.
    if (existing.approvalStatus !== "Unapproved") {
      const saved = await repository.saveCampaign({ ...existing, id: campaignId, businessId, approvalStatus: "Unapproved" });
      if (!saved) return res.status(409).json({ error: "Campaign could not be withdrawn for this business." });
    }
    return res.status(200).json({ workItemId: campaignId, approvalStatus: "Unapproved", currentCustomerPublication: false });
  }

  // Reactivation is an explicit owner approval. The existing approval pathway is
  // authoritative and customer publication rules still validate capability/content.
  let approved = existing.approvalStatus === "Approved" ? existing : await repository.approveCampaign(businessId, campaignId);
  if (!approved) return res.status(404).json({ error: "Campaign was not found for this business." });
  const capability = getCapabilityForRecommendationType(approved.campaignType);
  if (!capability || !capability.available || capability.supportedOutputType !== approved.campaignType ||
      typeof approved.campaignText !== "string" || !approved.campaignText.trim()) {
    // Fail closed: do not leave invalid work newly authorized.
    await repository.saveCampaign({ ...approved, id: campaignId, businessId, approvalStatus: "Unapproved" });
    return res.status(409).json({ error: "Campaign is not eligible for reactivation." });
  }
  return res.status(200).json({ workItemId: campaignId, approvalStatus: "Approved", currentCustomerPublication: true });
}

module.exports = async function handler(req, res) {
  if (req.method !== "PUT" && req.method !== "PATCH") {
    res.setHeader("Allow", "PUT, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  if (!businessId || !campaignId) {
    return res.status(400).json({ error: "A businessId and campaignId are required." });
  }

  try {
    const repository = getRepository();
    if (req.method === "PATCH") {
      return await handleLifecycleChange(req, res, repository, businessId, campaignId);
    }

    const campaign = req.body && req.body.campaign;
    const isApprovalRequest = campaign && campaign.approvalStatus === "Approved";
    const access = await authorizeBusinessOwnerRequest({
      req,
      businessId,
      action: isApprovalRequest
        ? DEMEOS_ACTIONS.APPROVE_OWN_MARKETING
        : DEMEOS_ACTIONS.CREATE_MARKETING,
      repository
    });
    if (!access.authenticated) return res.status(401).json({ error: "Authentication required." });
    if (!access.allowed) return res.status(403).json({ error: "Forbidden." });

    const requiredCampaignFields = [
      "campaignText", "campaignType", "campaignTypeLabel", "businessName", "createdAt", "approvalStatus"
    ];
    const isCampaignObject = campaign && typeof campaign === "object" && !Array.isArray(campaign);
    const hasInvalidCampaignField = !isCampaignObject || requiredCampaignFields.some(function (field) {
      return typeof campaign[field] !== "string" || !campaign[field].trim();
    });
    const campaignCapability = isCampaignObject ? getCapabilityForRecommendationType(campaign.campaignType) : null;
    if (hasInvalidCampaignField || !["Unapproved", "Approved"].includes(campaign.approvalStatus) ||
        !campaignCapability || !campaignCapability.available ||
        campaignCapability.supportedOutputType !== campaign.campaignType) {
      return res.status(400).json({ error: "DEMEOS received invalid campaign data." });
    }
    let campaignForPersistence = { ...campaign, campaignTypeLabel: campaignCapability.ownerFacingName };
    if (campaign.media !== undefined) {
      const requestedIds = Array.isArray(campaign.media) ? campaign.media.map(function (link) { return link && link.assetId; }).filter(Boolean) : [];
      const ownedAssets = await repository.getBusinessMediaAssetsByIds(businessId, requestedIds);
      const trustedMedia = normalizeMarketingMediaLinks(campaign.media, businessId, ownedAssets);
      if (!trustedMedia) return res.status(409).json({ error: "Campaign media could not be verified for this business." });
      campaignForPersistence.media = trustedMedia;
    }
    if (campaign.recommendationDecisionId) {
      const record = await repository.getKnownBusiness(businessId);
      const decisions = record && Array.isArray(record.recommendationDecisions) ? record.recommendationDecisions : [];
      const trustedDecision = decisions.find(function (decision) {
        return decision && decision.decisionId === String(campaign.recommendationDecisionId) &&
          decision.businessId === businessId;
      });
      if (!trustedDecision || trustedDecision.decision === "rejected" ||
          trustedDecision.suggestedCampaignType !== campaign.campaignType ||
          (campaign.recommendationId && trustedDecision.recommendationId &&
            campaign.recommendationId !== trustedDecision.recommendationId)) {
        return res.status(409).json({ error: "Campaign recommendation provenance could not be verified." });
      }
      campaignForPersistence = {
        ...campaignForPersistence,
        recommendationDecisionId: trustedDecision.decisionId,
        ...(trustedDecision.recommendationId ? { recommendationId: trustedDecision.recommendationId } : {}),
        recommendationAction: trustedDecision.decision
      };
    }

    if (isApprovalRequest) {
      let approvedCampaign = await repository.approveCampaign(businessId, campaignId);
      if (approvedCampaign) {
        const approvedCapability = getCapabilityForRecommendationType(approvedCampaign.campaignType);
        if (approvedCapability && approvedCampaign.campaignTypeLabel !== approvedCapability.ownerFacingName) {
          const normalizedCampaign = await repository.saveCampaign({
            ...approvedCampaign, id: campaignId, businessId, campaignTypeLabel: approvedCapability.ownerFacingName
          });
          if (!normalizedCampaign) throw new Error("Could not normalize approved campaign label.");
          approvedCampaign = normalizedCampaign;
        }
      }
      if (!approvedCampaign) {
        const createAccess = await authorizeBusinessOwnerRequest({
          req, businessId, action: DEMEOS_ACTIONS.CREATE_MARKETING, repository
        });
        if (!createAccess.authenticated) return res.status(401).json({ error: "Authentication required." });
        if (!createAccess.allowed) return res.status(403).json({ error: "Forbidden." });
        const restoredCampaign = await repository.saveCampaign({
          ...campaignForPersistence, id: campaignId, businessId, approvalStatus: "Unapproved"
        });
        if (restoredCampaign) approvedCampaign = await repository.approveCampaign(businessId, campaignId);
      }
      if (!approvedCampaign) return res.status(404).json({ error: "Campaign was not found for this business." });
    } else {
      const savedCampaign = await repository.saveCampaign({ ...campaignForPersistence, id: campaignId, businessId });
      if (!savedCampaign) return res.status(409).json({ error: "Campaign could not be saved for this business." });
    }
    return res.status(204).end();
  } catch (error) {
    console.error("Could not persist campaign:", error);
    return res.status(500).json({ error: "DEMEOS could not persist this campaign." });
  }
};
