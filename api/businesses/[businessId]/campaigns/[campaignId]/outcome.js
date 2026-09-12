const { getRepository } = require("../../../../_lib/persistence.js");
const {
  authorizeBusinessOwnerRequest
} = require("../../../../_lib/demeos-business-owner-authorization.js");
const { DEMEOS_ACTIONS } = require("../../../../_lib/demeos-rules.js");
const { ALLOWED_CAMPAIGN_OUTCOMES } = require("../../../../_lib/campaign-outcome-contract.js");

const ownerNoteMaximumLength = 1000;

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  if (!businessId || !campaignId) {
    return res.status(400).json({ error: "DEMEOS received invalid campaign outcome data." });
  }

  try {
    const repository = getRepository();
    const access = await authorizeBusinessOwnerRequest({
      req,
      businessId,
      action: DEMEOS_ACTIONS.RECORD_CAMPAIGN_OUTCOME,
      repository
    });
    if (!access.authenticated) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const selectedOutcome = req.body && req.body.outcome;
    const ownerNote = req.body && req.body.ownerNote;
    if (
      !ALLOWED_CAMPAIGN_OUTCOMES.includes(selectedOutcome) ||
      (ownerNote !== undefined && (
        typeof ownerNote !== "string" || ownerNote.length > ownerNoteMaximumLength
      ))
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
    const campaign = await repository.saveCampaignOutcome(businessId, campaignId, outcome);
    if (!campaign) {
      return res.status(409).json({ error: "Only an approved campaign belonging to this business can receive an outcome." });
    }
    return res.status(200).json({ outcome: campaign.outcome });
  } catch (error) {
    console.error("Could not persist campaign outcome:", error);
    return res.status(500).json({ error: "DEMEOS could not persist this campaign outcome." });
  }
};

module.exports.allowedOutcomes = ALLOWED_CAMPAIGN_OUTCOMES;
