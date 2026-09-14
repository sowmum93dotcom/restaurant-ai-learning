const { getRepository } = require("../../../_lib/persistence.js");
const { parseCustomerFeedback } = require("../../../_lib/customer-feedback-contract.js");
const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../../../_lib/demeos-rules.js");

function getInteraction(req) {
  return typeof req.query.interaction === "string" ? req.query.interaction.trim() : "";
}

async function handleParticipation(req, res, campaignId) {
  if (!canPerformDemeosAction({
    actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
    action: DEMEOS_ACTIONS.RECORD_CUSTOMER_PARTICIPATION
  })) {
    return res.status(403).json({ error: "DEMEOS permission denied." });
  }
  const action = req.body && req.body.action;
  if (!campaignId || action !== "Interested") {
    return res.status(400).json({ error: "Valid DEMEOS work and participation are required." });
  }
  try {
    const participation = await getRepository().recordCustomerParticipation(campaignId, action);
    if (!participation) return res.status(404).json({ error: "Approved DEMEOS work was not found." });
    return res.status(201).json({ participation: { action: participation.action } });
  } catch (error) {
    console.error("Could not record customer participation:", error);
    return res.status(500).json({ error: "DEMEOS could not record participation." });
  }
}

async function handleFeedback(req, res, campaignId) {
  if (!canPerformDemeosAction({
    actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
    action: DEMEOS_ACTIONS.RECORD_CUSTOMER_FEEDBACK
  })) {
    return res.status(403).json({ error: "DEMEOS permission denied." });
  }
  const feedback = parseCustomerFeedback(req.body);
  if (!campaignId || !feedback) {
    return res.status(400).json({ error: "Valid customer feedback is required." });
  }
  try {
    const recorded = await getRepository().recordCustomerFeedback(campaignId, feedback);
    if (!recorded) return res.status(404).json({ error: "Approved DEMEOS work was not found." });
    return res.status(201).json({ feedback: { response: recorded.response } });
  } catch (error) {
    console.error("Could not record customer feedback:", error);
    return res.status(500).json({ error: "DEMEOS could not record feedback." });
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  const interaction = getInteraction(req);
  if (interaction === "participation") return handleParticipation(req, res, campaignId);
  if (interaction === "feedback") return handleFeedback(req, res, campaignId);
  return res.status(404).json({ error: "Customer interaction was not found." });
};
