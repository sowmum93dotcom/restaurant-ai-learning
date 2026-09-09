const DEMEOS_ACTOR_CONTEXT_STATES = Object.freeze({
  PUBLIC: "public",
  AUTHENTICATED: "authenticated",
  UNRESOLVED: "unresolved"
});

const ACTOR_SCOPES = Object.freeze({
  PUBLIC_CUSTOMER: "public-customer",
  BUSINESS_OWNER: "business-owner",
  ADMIN: "demeos-admin"
});

function isNonEmptyIdentifier(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createPublicCustomerContext() {
  return Object.freeze({
    state: DEMEOS_ACTOR_CONTEXT_STATES.PUBLIC,
    actorScope: ACTOR_SCOPES.PUBLIC_CUSTOMER,
    authenticated: false,
    businessId: null
  });
}

function createUnresolvedActorContext() {
  return Object.freeze({
    state: DEMEOS_ACTOR_CONTEXT_STATES.UNRESOLVED,
    actorScope: null,
    authenticated: false,
    businessId: null
  });
}

// Callers may supply these identifiers only after a future server-side
// authentication mechanism has established their trust. This module does not
// inspect requests or turn client-provided claims into trusted identity.
function createAuthenticatedBusinessOwnerContext({ trustedIdentityId, businessId } = {}) {
  if (!isNonEmptyIdentifier(trustedIdentityId) || !isNonEmptyIdentifier(businessId)) {
    return createUnresolvedActorContext();
  }

  return Object.freeze({
    state: DEMEOS_ACTOR_CONTEXT_STATES.AUTHENTICATED,
    actorScope: ACTOR_SCOPES.BUSINESS_OWNER,
    authenticated: true,
    trustedIdentityId,
    businessId
  });
}

function createAuthenticatedAdminContext({ trustedIdentityId } = {}) {
  if (!isNonEmptyIdentifier(trustedIdentityId)) return createUnresolvedActorContext();

  return Object.freeze({
    state: DEMEOS_ACTOR_CONTEXT_STATES.AUTHENTICATED,
    actorScope: ACTOR_SCOPES.ADMIN,
    authenticated: true,
    trustedIdentityId,
    businessId: null
  });
}

function isTrustedBusinessOwnerContext(context, businessId) {
  return Boolean(
    context &&
    context.state === DEMEOS_ACTOR_CONTEXT_STATES.AUTHENTICATED &&
    context.authenticated === true &&
    context.actorScope === ACTOR_SCOPES.BUSINESS_OWNER &&
    isNonEmptyIdentifier(context.trustedIdentityId) &&
    isNonEmptyIdentifier(businessId) &&
    context.businessId === businessId
  );
}

function isTrustedAdminContext(context) {
  return Boolean(
    context &&
    context.state === DEMEOS_ACTOR_CONTEXT_STATES.AUTHENTICATED &&
    context.authenticated === true &&
    context.actorScope === ACTOR_SCOPES.ADMIN &&
    isNonEmptyIdentifier(context.trustedIdentityId) &&
    context.businessId === null
  );
}

module.exports = {
  DEMEOS_ACTOR_CONTEXT_STATES,
  createPublicCustomerContext,
  createAuthenticatedBusinessOwnerContext,
  createAuthenticatedAdminContext,
  createUnresolvedActorContext,
  isTrustedBusinessOwnerContext,
  isTrustedAdminContext
};
