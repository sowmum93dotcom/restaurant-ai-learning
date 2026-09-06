const { getRepository } = require("../../../../_lib/persistence.js");

const allowedOutcomes = ["Positive", "Mixed", "No noticeable result", "Not used yet"];

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  const selectedOutcome = req.body && req.body.outcome;
  const ownerNote = req.body && req.body.ownerNote;
  if (
    !businessId || !campaignId || !allowedOutcomes.includes(selectedOutcome) ||
    (ownerNote !== undefined && typeof ownerNote !== "string")
  ) {
    return res.status(400).json({ error: "DEMEOS received invalid campaign outcome data." });
  }

  const outcome = {
    businessId,
    campaignId,
    outcome: selectedOutcome,
    ownerNote: typeof ownerNote === "string" ? ownerNote.trim() : "",
    savedAt: new Date().toISOString()
  };
  try {
    const campaign = await getRepository().saveCampaignOutcome(businessId, campaignId, outcome);
    if (!campaign) {
      return res.status(409).json({ error: "Only an approved campaign belonging to this business can receive an outcome." });
    }
    return res.status(200).json({ outcome: campaign.outcome });
  } catch (error) {
    console.error("Could not persist campaign outcome:", error);
    return res.status(500).json({ error: "DEMEOS could not persist this campaign outcome." });
  }
};

module.exports.allowedOutcomes = allowedOutcomes;
