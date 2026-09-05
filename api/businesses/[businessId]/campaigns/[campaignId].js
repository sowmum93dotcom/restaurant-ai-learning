const { getRepository } = require("../../../_lib/persistence.js");

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
  if (
    hasInvalidCampaignField ||
    !["Unapproved", "Approved"].includes(campaign.approvalStatus)
  ) {
    return res.status(400).json({ error: "DEMEOS received invalid campaign data." });
  }
  try {
    await getRepository().saveCampaign({ ...campaign, id: campaignId, businessId });
    return res.status(204).end();
  } catch (error) {
    console.error("Could not persist campaign:", error);
    return res.status(500).json({ error: "DEMEOS could not persist this campaign." });
  }
};
