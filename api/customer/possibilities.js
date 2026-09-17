const { getRepository } = require("../_lib/persistence.js");
const { DEMEOS_ACTOR_SCOPES, DEMEOS_ACTIONS, canPerformDemeosAction } = require("../_lib/demeos-rules.js");
const { createAuthenticatedCustomerContext } = require("../_lib/demeos-actor-context.js");
const { authorizeDemeosAction } = require("../_lib/demeos-authorization.js");
const { resolveTrustedCustomerIdentityFromRequest } = require("../_lib/demeos-customer-authentication.js");
const { findCustomerPossibilities, validateConfirmedUnderstanding } = require("../_lib/customer-possibility-contract.js");
const {
  prepareCustomerPossibilityIssuanceTrust,
  confirmCustomerPossibilityIssuanceDelivery
} = require("../_lib/customer-possibility-issuance-trust.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!canPerformDemeosAction({
    actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
    action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE
  })) return res.status(403).json({ error: "DEMEOS permission denied." });

  const understanding = validateConfirmedUnderstanding(req.body);
  if (!understanding) return res.status(400).json({ error: "A valid confirmed customer understanding is required." });
  try {
    const repository = getRepository();
    const work = await repository.getCustomerWork();
    let preferences = [];
    let feedback = [];
    let persistedIntention = null;
    const identity = await resolveTrustedCustomerIdentityFromRequest(req);
    const customerIdentity = identity && !(await repository.getOwnedBusinessIds(identity.trustedCustomerIdentityId)).length
      ? identity : null;
    if (customerIdentity) {
      const context = createAuthenticatedCustomerContext(customerIdentity);
      // Confirmation is the authoritative point at which an authenticated
      // customer's current intention becomes durable evidence. The browser does
      // not supply an owner or an intention id.
      persistedIntention = await repository.saveCustomerIntention(
        customerIdentity.trustedCustomerIdentityId,
        { intention: understanding.intention, customerText: understanding.customerText,
          understanding: understanding.understanding }
      );
      if (!persistedIntention || !persistedIntention.intentionId) {
        return res.status(500).json({ error: "DEMEOS could not record the current intention." });
      }
      const controls = typeof repository.getCustomerPrivacyControls === "function"
        ? await repository.getCustomerPrivacyControls(customerIdentity.trustedCustomerIdentityId)
        : { usePreferencesAsGuidance: false, useFeedbackAsGuidance: false };
      if (controls.usePreferencesAsGuidance && authorizeDemeosAction({ actorContext: context, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PREFERENCES }).allowed) {
        preferences = await repository.getCustomerPreferences(customerIdentity.trustedCustomerIdentityId, 50);
      }
      if (controls.useFeedbackAsGuidance && typeof repository.getCustomerFeedback === "function" &&
          authorizeDemeosAction({ actorContext: context, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_FEEDBACK }).allowed) {
        feedback = await repository.getCustomerFeedback(customerIdentity.trustedCustomerIdentityId, 50);
      }
    }
    let possibilities = findCustomerPossibilities(understanding, work, undefined, preferences, feedback);
    if (customerIdentity) {
      await prepareCustomerPossibilityIssuanceTrust();
      const issuedWorkItemIds = await repository.recordCustomerPossibilityIssuance(
        customerIdentity.trustedCustomerIdentityId, possibilities, understanding, persistedIntention.intentionId);
      const confirmedWorkItemIds = await confirmCustomerPossibilityIssuanceDelivery(
        customerIdentity.trustedCustomerIdentityId, issuedWorkItemIds);
      const issued = new Set(confirmedWorkItemIds);
      possibilities = possibilities.filter(function (possibility) { return issued.has(possibility.workItemId); });
    }
    return res.status(200).json({ possibilities });
  } catch (error) {
    console.error("Could not prepare customer possibilities:", error);
    return res.status(500).json({ error: "DEMEOS could not prepare possibilities." });
  }
};
