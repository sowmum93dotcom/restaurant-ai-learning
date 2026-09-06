const { getRepository } = require("../../_lib/persistence.js");

const allowedDecisions = ["used", "modified", "rejected"];
const allowedCampaignTypes = ["full", "social", "email"];

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  const recommendationTitle = req.body && req.body.recommendationTitle;
  const suggestedCampaignType = req.body && req.body.suggestedCampaignType;
  const decision = req.body && req.body.decision;
  if (
    !businessId || typeof recommendationTitle !== "string" || !recommendationTitle.trim() ||
    recommendationTitle.length > 500 || !allowedCampaignTypes.includes(suggestedCampaignType) ||
    !allowedDecisions.includes(decision)
  ) {
    return res.status(400).json({ error: "DEMEOS received invalid recommendation decision data." });
  }

  const record = {
    businessId,
    recommendationTitle: recommendationTitle.trim(),
    suggestedCampaignType,
    decision,
    timestamp: new Date().toISOString()
  };
  try {
    const saved = await getRepository().saveRecommendationDecision(record);
    if (!saved) return res.status(404).json({ error: "Business not found." });
    return res.status(201).json({ recommendationDecision: saved });
  } catch (error) {
    console.error("Could not persist recommendation decision:", error);
    return res.status(500).json({ error: "DEMEOS could not persist this recommendation decision." });
  }
};

module.exports.allowedDecisions = allowedDecisions;
