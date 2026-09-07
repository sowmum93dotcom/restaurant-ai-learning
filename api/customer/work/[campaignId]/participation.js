const { getRepository } = require("../../../_lib/persistence.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  const businessId = req.body && typeof req.body.businessId === "string" ? req.body.businessId.trim() : "";
  const action = req.body && req.body.action;
  if (!campaignId || !businessId || action !== "Interested") {
    return res.status(400).json({ error: "Valid DEMEOS work and participation are required." });
  }
  try {
    const participation = await getRepository().recordCustomerParticipation(businessId, campaignId, action);
    if (!participation) return res.status(404).json({ error: "Approved DEMEOS work was not found." });
    return res.status(201).json({ participation: { action: participation.action } });
  } catch (error) {
    console.error("Could not record customer participation:", error);
    return res.status(500).json({ error: "DEMEOS could not record participation." });
  }
};
