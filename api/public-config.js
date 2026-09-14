const {
  resolveTrustedCustomerIdentityFromRequest
} = require("./_lib/demeos-customer-authentication.js");
const { createAuthenticatedCustomerContext } = require("./_lib/demeos-actor-context.js");
const { authorizeDemeosAction } = require("./_lib/demeos-authorization.js");
const { DEMEOS_ACTIONS } = require("./_lib/demeos-rules.js");
const { validateCustomerIntention } = require("./_lib/customer-intention-contract.js");
const { getRepository } = require("./_lib/persistence.js");

function isCustomerIdentityRequest(req) {
  return req?.query?.resource === "customer-identity" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/identity"));
}

async function publicConfig(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const savedPossibilitiesRequest = req?.query?.resource === "customer-saved-possibilities" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/possibilities/saved"));
  if (savedPossibilitiesRequest || req?.query?.resource === "customer-intentions" ||
      (typeof req?.url === "string" && req.url.startsWith("/api/customer/intentions"))) {
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const identity = await resolveTrustedCustomerIdentityFromRequest(req);
    if (!identity) return res.status(401).json({ error: "Customer authentication required." });
    const repository = getRepository();
    // A known business owner is deliberately not treated as a customer merely
    // because the same authentication provider can authenticate both roles.
    if ((await repository.getOwnedBusinessIds(identity.trustedCustomerIdentityId)).length) {
      return res.status(403).json({ error: "Customer permission required." });
    }
    const context = createAuthenticatedCustomerContext(identity);
    const action = savedPossibilitiesRequest
      ? (req.method === 'POST' ? DEMEOS_ACTIONS.RECORD_OWN_CUSTOMER_SAVED_POSSIBILITY : DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_SAVED_POSSIBILITIES)
      : (req.method === 'POST' ? DEMEOS_ACTIONS.RECORD_OWN_CUSTOMER_INTENTION : DEMEOS_ACTIONS.VIEW_OWN_CUSTOMER_INTENTIONS);
    if (!authorizeDemeosAction({ actorContext: context, action }).allowed) return res.status(403).json({ error: "DEMEOS permission denied." });
    if (savedPossibilitiesRequest) {
      if (req.method === 'GET') return res.status(200).json({ possibilities: await repository.getCustomerSavedPossibilities(identity.trustedCustomerIdentityId, 50) });
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
    const intention = validateCustomerIntention(req.body);
    if (!intention) return res.status(400).json({ error: "A valid confirmed intention is required." });
    const saved = await repository.saveCustomerIntention(identity.trustedCustomerIdentityId, intention);
    return res.status(201).json({ intention: saved });
  }
  if (isCustomerIdentityRequest(req)) {
    const identity = await resolveTrustedCustomerIdentityFromRequest(req);
    return res.status(200).json({ authenticated: Boolean(identity) });
  }

  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  if (typeof clerkPublishableKey !== "string" || !clerkPublishableKey.trim()) {
    return res.status(503).json({ error: "Authentication configuration is unavailable." });
  }

  // This endpoint is intentionally restricted to configuration safe for any browser.
  return res.status(200).json({
    clerkPublishableKey: clerkPublishableKey.trim(),
    businessIdDiagnosticEnabled: process.env.DEMEOS_BUSINESS_ID_DIAGNOSTIC_ENABLED === "true"
  });
}

module.exports = publicConfig;
