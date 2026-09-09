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

function deniedResult(action, businessId) {
  const actorContext = createUnresolvedActorContext();
  return Object.freeze({
    allowed: false,
    actorContext,
    authorization: deniedAuthorization(actorContext, action, businessId)
  });
}

async function authorizeBusinessOwnerRequest({
  req,
  businessId,
  action,
  repository,
  authenticationOptions
} = {}) {
  if (!isNonEmptyString(businessId) || !isNonEmptyString(action)) {
    return deniedResult(action, businessId);
  }

  try {
    const trustedIdentity = await resolveTrustedIdentityFromRequest(req, authenticationOptions);
    if (!trustedIdentity) return deniedResult(action, businessId);

    const actorContext = await resolveBusinessOwnerContext({
      trustedIdentityId: trustedIdentity.trustedIdentityId,
      businessId,
      repository
    });
    if (!actorContext || actorContext.authenticated !== true) {
      return deniedResult(action, businessId);
    }

    const authorization = authorizeDemeosAction({ actorContext, action, businessId });
    return Object.freeze({
      allowed: authorization.allowed === true,
      actorContext,
      authorization
    });
  } catch (_error) {
    return deniedResult(action, businessId);
  }
}

module.exports = { authorizeBusinessOwnerRequest };
