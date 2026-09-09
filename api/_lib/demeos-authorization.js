const {
  DEMEOS_ACTOR_SCOPES,
  canPerformDemeosAction
} = require("./demeos-rules.js");
const {
  DEMEOS_ACTOR_CONTEXT_STATES,
  isTrustedBusinessOwnerContext,
  isTrustedAdminContext
} = require("./demeos-actor-context.js");

function authorizationResult({ allowed, actorContext, action, businessId }) {
  return Object.freeze({
    allowed,
    actorScope: actorContext?.actorScope || null,
    action: action || null,
    businessId: businessId || null
  });
}

function isPublicCustomerContext(context) {
  return Boolean(
    context &&
    context.state === DEMEOS_ACTOR_CONTEXT_STATES.PUBLIC &&
    context.authenticated === false &&
    context.actorScope === DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER
  );
}

function authorizeDemeosAction({ actorContext, action, businessId } = {}) {
  let allowed = false;

  if (actorContext && action) {
    if (isPublicCustomerContext(actorContext)) {
      allowed = canPerformDemeosAction({ actorScope: actorContext.actorScope, action });
    } else if (actorContext.actorScope === DEMEOS_ACTOR_SCOPES.BUSINESS_OWNER) {
      allowed = isTrustedBusinessOwnerContext(actorContext, businessId) &&
        canPerformDemeosAction({ actorScope: actorContext.actorScope, action });
    } else if (actorContext.actorScope === DEMEOS_ACTOR_SCOPES.ADMIN) {
      allowed = isTrustedAdminContext(actorContext) &&
        canPerformDemeosAction({ actorScope: actorContext.actorScope, action });
    }
  }

  return authorizationResult({ allowed, actorContext, action, businessId });
}

module.exports = { authorizeDemeosAction };
