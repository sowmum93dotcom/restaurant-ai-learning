const { selectCustomerCatalogue } = require("../_lib/customer-catalogue.js");
const { getRepository } = require("../_lib/persistence.js");
const { DEMEOS_ACTOR_SCOPES, DEMEOS_ACTIONS, canPerformDemeosAction } = require("../_lib/demeos-rules.js");
const { createAuthenticatedCustomerContext } = require("../_lib/demeos-actor-context.js");
const { authorizeDemeosAction } = require("../_lib/demeos-authorization.js");
const { resolveTrustedCustomerIdentityFromRequest } = require("../_lib/demeos-customer-authentication.js");
const { validateConfirmedUnderstanding, validateCustomerPlace } = require("../_lib/customer-possibility-contract.js");
const {prepareCustomerSearch,completeCustomerSearch}=require('../_lib/customer-search-service');
const {getCustomerSearchConfiguration,deferCustomerSearch}=require('../_lib/customer-search-registry');
const {
  prepareCustomerPossibilityIssuanceTrust,
  confirmCustomerPossibilityIssuanceDelivery
} = require("../_lib/customer-possibility-issuance-trust.js");

function createPossibilitiesHandler({configuration=getCustomerSearchConfiguration(),defer=deferCustomerSearch}={}) {
return async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
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
  const place = validateCustomerPlace(req.body);
  if (place === null) return res.status(400).json({ error: "A valid optional place is required." });
  try {
    const repository = getRepository();
    const catalogue = selectCustomerCatalogue(await repository.getCustomerWork({forCatalogueValidation:true}), req);
    const work = catalogue.work;
    let preferences = [];
    let feedback = [];
    let persistedIntention = null;
    // Fictional examples never become customer history or trusted issuance.
    const identity = catalogue.testMode ? null : await resolveTrustedCustomerIdentityFromRequest(req);
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
    const locale=typeof req.headers?.['x-demeos-customer-locale']==='string'?req.headers['x-demeos-customer-locale']:'en';
    const prepared=await prepareCustomerSearch({understanding,work,preferences,feedback,place,locale,configuration});
    let possibilities=prepared.possibilities;
    if (customerIdentity) {
      await prepareCustomerPossibilityIssuanceTrust();
      const issuedWorkItemIds = await repository.recordCustomerPossibilityIssuance(
        customerIdentity.trustedCustomerIdentityId, possibilities, understanding, persistedIntention.intentionId);
      const confirmedWorkItemIds = await confirmCustomerPossibilityIssuanceDelivery(
        customerIdentity.trustedCustomerIdentityId, issuedWorkItemIds);
      const issued = new Set(confirmedWorkItemIds);
      possibilities = possibilities.filter(function (possibility) { return issued.has(possibility.workItemId); });
    }
    possibilities=await completeCustomerSearch({prepared,possibilities,understanding,work,identity:customerIdentity,testMode:catalogue.testMode,configuration,defer});
    return res.status(200).json({ possibilities, ...(place ? { placeApplied: true } : {}),
      ...(catalogue.testMode ? { testMode: true } : {}) });
  } catch (error) {
    console.error("Could not prepare customer possibilities:", error);
    return res.status(500).json({ error: "DEMEOS could not prepare possibilities." });
  }
};
}
module.exports=createPossibilitiesHandler();
module.exports.createPossibilitiesHandler=createPossibilitiesHandler;
