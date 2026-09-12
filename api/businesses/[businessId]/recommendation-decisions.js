const { getRepository } = require("../../_lib/persistence.js");
const {
  authorizeBusinessOwnerRequest
} = require("../../_lib/demeos-business-owner-authorization.js");
const { DEMEOS_ACTIONS } = require("../../_lib/demeos-rules.js");

const allowedDecisions = ["used", "modified", "rejected"];
const allowedCampaignTypes = ["full", "social", "email"];

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  if (!businessId) {
    return res.status(400).json({ error: "DEMEOS received invalid recommendation decision data." });
  }

  try {
    const repository = getRepository();
    const access = await authorizeBusinessOwnerRequest({
      req,
      businessId,
      action: DEMEOS_ACTIONS.RECORD_RECOMMENDATION_DECISION,
      repository
    });
    if (!access.authenticated) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const recommendationTitle = req.body && req.body.recommendationTitle;
    const suggestedCampaignType = req.body && req.body.suggestedCampaignType;
    const decision = req.body && req.body.decision;
    if (
      typeof recommendationTitle !== "string" || !recommendationTitle.trim() ||
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
    const saved = await repository.saveRecommendationDecision(record);
    if (!saved) return res.status(404).json({ error: "Business not found." });
    return res.status(201).json({ recommendationDecision: saved });
  } catch (error) {
    console.error("Could not persist recommendation decision:", error);
    return res.status(500).json({ error: "DEMEOS could not persist this recommendation decision." });
  }
};

module.exports.allowedDecisions = allowedDecisions;
