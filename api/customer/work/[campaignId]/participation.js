const { getRepository } = require("../../../_lib/persistence.js");
const { parseCustomerFeedback } = require("../../../_lib/customer-feedback-contract.js");
const { resolveTrustedCustomerIdentityFromRequest } = require("../../../_lib/demeos-customer-authentication.js");
const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../../../_lib/demeos-rules.js");

async function resolveCustomer(req, repository) {
  const identity = await resolveTrustedCustomerIdentityFromRequest(req);
  if (!identity) return { status: 401 };
  if ((await repository.getOwnedBusinessIds(identity.trustedCustomerIdentityId)).length) return { status: 403 };
  return { status: 200, customerId: identity.trustedCustomerIdentityId };
}

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
    const repository = getRepository();
    const customer = await resolveCustomer(req, repository);
    if (customer.status !== 200) return res.status(customer.status).json({ error: customer.status === 401
      ? "Customer authentication is required." : "Business owners cannot record customer feedback." });
    const recorded = await repository.recordCustomerFeedback(campaignId, feedback,
      customer.customerId);
    if (!recorded) return res.status(404).json({ error: "An issued, approved DEMEOS possibility was not found." });
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
    const customer = await resolveCustomer(req, repository);
    if (customer.status !== 200) return res.status(customer.status).json({ error: customer.status === 401
      ? "Customer authentication is required." : "Business owners cannot record customer participation." });
    const participation = await repository.recordCustomerParticipation(campaignId, action,
      customer.customerId);
    if (!participation) return res.status(404).json({ error: "An issued, approved DEMEOS possibility was not found." });
    return res.status(201).json({ participation: { action: participation.action } });
  } catch (error) {
    console.error("Could not record customer participation:", error);
    return res.status(500).json({ error: "DEMEOS could not record participation." });
  }
};
