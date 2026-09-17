const {
  resolveTrustedCustomerIdentityFromRequest
} = require("./_lib/demeos-customer-authentication.js");
const {
  getAllowedClerkPublishableKey,
  getClerkConfigurationStatus
} = require("./_lib/demeos-authentication.js");
const { createAuthenticatedCustomerContext } = require("./_lib/demeos-actor-context.js");
const { authorizeDemeosAction } = require("./_lib/demeos-authorization.js");
const { DEMEOS_ACTIONS } = require("./_lib/demeos-rules.js");
const { validateCustomerIntention } = require("./_lib/customer-intention-contract.js");
const { validateCustomerPreference } = require("./_lib/customer-preference-contract.js");
const { buildTrustedCustomerUnderstanding } = require("./_lib/customer-understanding-context.js");
const { getRepository } = require("./_lib/persistence.js");

function isCustomerIdentityRequest(req) {
  return req?.query?.resource === "customer-identity" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/identity"));
}

async function publicConfig(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const understandingRequest = req?.query?.resource === "customer-understanding" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/understanding"));
  if (understandingRequest) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const identity = await resolveTrustedCustomerIdentityFromRequest(req);
    const repository = getRepository();
    let preferences = [];
    let feedback = [];
    if (identity) {
      if ((await repository.getOwnedBusinessIds(identity.trustedCustomerIdentityId)).length) {
        return res.status(403).json({ error: "Customer permission required." });
      }
      const context = createAuthenticatedCustomerContext(identity);
      if (!authorizeDemeosAction({ actorContext: context, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PREFERENCES }).allowed) {
        return res.status(403).json({ error: "DEMEOS permission denied." });
      }
      const controls = typeof repository.getCustomerPrivacyControls === "function"
        ? await repository.getCustomerPrivacyControls(identity.trustedCustomerIdentityId)
        : { usePreferencesAsGuidance: false, useFeedbackAsGuidance: false };
      if (controls.usePreferencesAsGuidance) {
        preferences = await repository.getCustomerPreferences(identity.trustedCustomerIdentityId, 50);
      }
      if (controls.useFeedbackAsGuidance && typeof repository.getCustomerFeedback === "function" &&
          authorizeDemeosAction({ actorContext: context, action: DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_FEEDBACK }).allowed) {
        feedback = await repository.getCustomerFeedback(identity.trustedCustomerIdentityId, 50);
      }
    }
    const understanding = buildTrustedCustomerUnderstanding(req.body, preferences, feedback);
    if (!understanding) return res.status(400).json({ error: "A valid current customer intention is required." });
    return res.status(200).json({ understanding });
  }
  const savedPossibilitiesRequest = req?.query?.resource === "customer-saved-possibilities" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/possibilities/saved"));
  const participationRequest = req?.query?.resource === "customer-participation" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/participation"));
  const preferencesRequest = req?.query?.resource === "customer-preferences" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/preferences"));
  const privacyControlsRequest = req?.query?.resource === "customer-privacy-controls" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/privacy-controls"));
  if (privacyControlsRequest || preferencesRequest || participationRequest || savedPossibilitiesRequest || req?.query?.resource === "customer-intentions" ||
      (typeof req?.url === "string" && req.url.startsWith("/api/customer/intentions"))) {
    const allowedMethods = participationRequest ? ['GET'] : privacyControlsRequest ? ['GET', 'POST'] : ['GET', 'POST', 'DELETE'];
    if (!allowedMethods.includes(req.method)) {
      res.setHeader("Allow", allowedMethods.join(", "));
      return res.status(405).json({ error: "Method not allowed" });
    }
    const identity = await resolveTrustedCustomerIdentityFromRequest(req);
    if (!identity) return res.status(401).json({ error: "Customer authentication required." });
    const repository = getRepository();
    if ((await repository.getOwnedBusinessIds(identity.trustedCustomerIdentityId)).length) {
      return res.status(403).json({ error: "Customer permission required." });
    }
    const context = createAuthenticatedCustomerContext(identity);
    const action = privacyControlsRequest
      ? (req.method === 'POST' ? DEMEOS_ACTIONS.MANAGE_OWN_CUSTOMER_PRIVACY_CONTROLS : DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PRIVACY_CONTROLS)
      : preferencesRequest
      ? (req.method === 'POST' ? DEMEOS_ACTIONS.RECORD_OWN_CUSTOMER_PREFERENCE : req.method === 'DELETE'
        ? DEMEOS_ACTIONS.REMOVE_OWN_CUSTOMER_PREFERENCE : DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PREFERENCES)
      : participationRequest ? DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_PARTICIPATION : savedPossibilitiesRequest
      ? (req.method === 'POST' ? DEMEOS_ACTIONS.RECORD_OWN_CUSTOMER_SAVED_POSSIBILITY : req.method === 'DELETE'
        ? DEMEOS_ACTIONS.REMOVE_OWN_CUSTOMER_SAVED_POSSIBILITY : DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_SAVED_POSSIBILITIES)
      : (req.method === 'POST' ? DEMEOS_ACTIONS.RECORD_OWN_CUSTOMER_INTENTION : req.method === 'DELETE'
        ? DEMEOS_ACTIONS.REMOVE_OWN_CUSTOMER_INTENTION : DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_INTENTIONS);
    if (!authorizeDemeosAction({ actorContext: context, action }).allowed) return res.status(403).json({ error: "DEMEOS permission denied." });
    if (privacyControlsRequest) {
      if (req.method === 'GET') return res.status(200).json({ controls: await repository.getCustomerPrivacyControls(identity.trustedCustomerIdentityId) });
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).sort().join(",") !== "useFeedbackAsGuidance,usePreferencesAsGuidance" ||
          typeof body.usePreferencesAsGuidance !== "boolean" || typeof body.useFeedbackAsGuidance !== "boolean") {
        return res.status(400).json({ error: "Valid privacy controls are required." });
      }
      const controls = await repository.saveCustomerPrivacyControls(identity.trustedCustomerIdentityId, body);
      return res.status(200).json({ controls });
    }
    if (preferencesRequest) {
      if (req.method === 'GET') return res.status(200).json({ preferences: await repository.getCustomerPreferences(identity.trustedCustomerIdentityId, 50) });
      if (req.method === 'DELETE') {
        const body = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
            typeof body.preferenceId !== "string" || !/^\d+$/.test(body.preferenceId)) {
          return res.status(400).json({ error: "A valid preference reference is required." });
        }
        const removed = await repository.removeCustomerPreference(identity.trustedCustomerIdentityId, body.preferenceId);
        if (!removed) return res.status(404).json({ error: "Preference not found." });
        return res.status(200).json({ removed: true });
      }
      const preference = validateCustomerPreference(req.body);
      if (!preference) return res.status(400).json({ error: "A valid explicit preference is required." });
      return res.status(201).json({ preference: await repository.saveCustomerPreference(identity.trustedCustomerIdentityId, preference) });
    }
    if (participationRequest) return res.status(200).json({ participations: await repository.getCustomerParticipations(identity.trustedCustomerIdentityId, 50) });
    if (savedPossibilitiesRequest) {
      if (req.method === 'GET') return res.status(200).json({ possibilities:
        typeof repository.getCustomerIssuedPossibilities === "function"
          ? await repository.getCustomerIssuedPossibilities(identity.trustedCustomerIdentityId, 50)
          : await repository.getCustomerSavedPossibilities(identity.trustedCustomerIdentityId, 50) });
      if (req.method === 'DELETE') {
        const body = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
            typeof body.savedPossibilityId !== "string" || !/^\d+$/.test(body.savedPossibilityId)) {
          return res.status(400).json({ error: "A valid saved possibility reference is required." });
        }
        const removed = await repository.removeCustomerSavedPossibility(identity.trustedCustomerIdentityId, body.savedPossibilityId);
        if (!removed) return res.status(404).json({ error: "Saved possibility not found." });
        return res.status(200).json({ removed: true });
      }
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
          typeof body.workItemId !== "string" || !body.workItemId.trim() || body.workItemId !== body.workItemId.trim() || body.workItemId.length > 200) {
        return res.status(400).json({ error: "A valid possibility reference is required." });
      }
      const saved = await repository.saveCustomerPossibility(identity.trustedCustomerIdentityId, body.workItemId);
      if (!saved) return res.status(404).json({ error: "This possibility is no longer available to save." });
      return res.status(201).json({ possibility: saved });
    }
    if (req.method === 'GET') return res.status(200).json({ intentions: await repository.getCustomerIntentions(identity.trustedCustomerIdentityId, 50) });
    if (req.method === 'DELETE') {
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
          typeof body.intentionId !== "string" || !/^\d+$/.test(body.intentionId)) {
        return res.status(400).json({ error: "A valid intention reference is required." });
      }
      const removed = await repository.removeCustomerIntention(identity.trustedCustomerIdentityId, body.intentionId);
      if (!removed) return res.status(404).json({ error: "Intention not found." });
      return res.status(200).json({ removed: true });
    }
    const intention = validateCustomerIntention(req.body);
    if (!intention) return res.status(400).json({ error: "A valid confirmed intention is required." });
    const saved = await repository.saveCustomerIntention(identity.trustedCustomerIdentityId, intention);
    return res.status(201).json({ intention: saved });
  }
  if (isCustomerIdentityRequest(req)) {
    const identity = await resolveTrustedCustomerIdentityFromRequest(req);
    return res.status(200).json({ authenticated: Boolean(identity) });
  }

  const clerkPublishableKey = getAllowedClerkPublishableKey();
  if (!clerkPublishableKey) {
    const configurationStatus = getClerkConfigurationStatus();
    console.error(`[DEMEOS authentication] ${configurationStatus}`);
    return res.status(503).json({
      error: "Authentication configuration is unavailable.",
      configurationStatus
    });
  }

  return res.status(200).json({
    clerkPublishableKey,
    businessIdDiagnosticEnabled: process.env.DEMEOS_BUSINESS_ID_DIAGNOSTIC_ENABLED === "true"
  });
}

module.exports = publicConfig;
