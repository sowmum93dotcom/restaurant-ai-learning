const {
  resolveTrustedIdentityFromRequest
} = require("./demeos-authentication.js");
const {
  resolveBusinessOwnerContext
} = require("./demeos-business-owner-access.js");
const { authorizeDemeosAction } = require("./demeos-authorization.js");
const { createUnresolvedActorContext } = require("./demeos-actor-context.js");

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function deniedAuthorization(actorContext, action, businessId) {
  try {
    return authorizeDemeosAction({ actorContext, action, businessId });
  } catch (_error) {
    return Object.freeze({
      allowed: false,
      actorScope: null,
      action: isNonEmptyString(action) ? action : null,
      businessId: isNonEmptyString(businessId) ? businessId : null
    });
  }
}

function deniedResult(action, businessId, authenticated = false) {
  const actorContext = createUnresolvedActorContext();
  return Object.freeze({
    allowed: false,
    authenticated,
    actorContext,
    authorization: deniedAuthorization(actorContext, action, businessId)
  });
}

async function authorizeBusinessOwnerRequest({
  req,
  businessId,
  action,
  repository,
  authenticationOptions,
  application
} = {}) {
  if (!isNonEmptyString(businessId) || !isNonEmptyString(action)) {
    return deniedResult(action, businessId);
  }

  let trustedIdentity;
  try {
    trustedIdentity = await resolveTrustedIdentityFromRequest(req, authenticationOptions);
  } catch (_error) {
    return deniedResult(action, businessId);
  }
  if (!trustedIdentity) return deniedResult(action, businessId);

  try {
    const actorContext = await resolveBusinessOwnerContext({
      trustedIdentityId: trustedIdentity.trustedIdentityId,
      businessId,
      repository
    });
    if (!actorContext || actorContext.authenticated !== true) {
      return deniedResult(action, businessId, true);
    }

    const authorization = authorizeDemeosAction({ actorContext, action, businessId });
    const marketingActions = ['create-marketing', 'approve-own-marketing', 'record-campaign-outcome', 'record-recommendation-decision'];
    const requiredApplication = application || (marketingActions.includes(action) ? 'marketing' : null);
    let applicationAllowed = true;
    if (authorization.allowed && (requiredApplication || action === 'manage-business-media')) {
      const record = await repository.getKnownBusiness(businessId);
      const grants = require('./business-application-access').applicationAccess(record, businessId);
      applicationAllowed = requiredApplication ? ['marketing', 'selling'].includes(requiredApplication) && grants[requiredApplication] : grants.marketing || grants.selling;
    }
    return Object.freeze({
      allowed: authorization.allowed === true && applicationAllowed === true,
      authenticated: true,
      actorContext,
      authorization
    });
  } catch (_error) {
    return deniedResult(action, businessId, true);
  }
}

module.exports = { authorizeBusinessOwnerRequest };
