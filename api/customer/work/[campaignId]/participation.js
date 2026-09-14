const { getRepository } = require("../../../_lib/persistence.js");
const { parseCustomerFeedback } = require("../../../_lib/customer-feedback-contract.js");
const { resolveTrustedCustomerIdentityFromRequest } = require("../../../_lib/demeos-customer-authentication.js");
const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../../../_lib/demeos-rules.js");

async function handleFeedback(req, res, campaignId) {
  if (!canPerformDemeosAction({
    actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
    action: DEMEOS_ACTIONS.RECORD_CUSTOMER_FEEDBACK
  })) {
    return res.status(403).json({ error: "DEMEOS permission denied." });
  }
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
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  if (req.query && req.query.interaction === "feedback") return handleFeedback(req, res, campaignId);

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
    const repository = getRepository();
    let identity = null;
    try { identity = await resolveTrustedCustomerIdentityFromRequest(req); } catch (_authenticationError) { identity = null; }
    // Provider-verified admins are rejected by customer authentication. This
    // additional authoritative ownership check keeps known business owners out
    // of customer-owned history even when provider role metadata is absent.
    if (identity && (await repository.getOwnedBusinessIds(identity.trustedCustomerIdentityId)).length) identity = null;
    const participation = await repository.recordCustomerParticipation(campaignId, action,
      identity ? identity.trustedCustomerIdentityId : null);
    if (!participation) return res.status(404).json({ error: "Approved DEMEOS work was not found." });
    return res.status(201).json({ participation: { action: participation.action } });
  } catch (error) {
    console.error("Could not record customer participation:", error);
    return res.status(500).json({ error: "DEMEOS could not record participation." });
  }
};
