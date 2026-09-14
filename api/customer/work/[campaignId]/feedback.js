const { getRepository } = require("../../../_lib/persistence.js");
const { parseCustomerFeedback } = require("../../../_lib/customer-feedback-contract.js");
const { DEMEOS_ACTOR_SCOPES, DEMEOS_ACTIONS, canPerformDemeosAction } = require("../../../_lib/demeos-rules.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!canPerformDemeosAction({ actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
    action: DEMEOS_ACTIONS.RECORD_CUSTOMER_FEEDBACK })) {
    return res.status(403).json({ error: "DEMEOS permission denied." });
  }
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  const feedback = parseCustomerFeedback(req.body);
  if (!campaignId || !feedback) return res.status(400).json({ error: "Valid customer feedback is required." });
  try {
    const recorded = await getRepository().recordCustomerFeedback(campaignId, feedback);
    if (!recorded) return res.status(404).json({ error: "Approved DEMEOS work was not found." });
    return res.status(201).json({ feedback: { response: recorded.response } });
  } catch (error) {
    console.error("Could not record customer feedback:", error);
    return res.status(500).json({ error: "DEMEOS could not record feedback." });
  }
};
