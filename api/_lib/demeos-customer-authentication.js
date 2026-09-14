const {
  resolveTrustedIdentityFromRequest
} = require("./demeos-authentication.js");

async function resolveTrustedCustomerIdentityFromRequest(req, options = {}) {
  const resolveIdentity = options.resolveTrustedIdentityFromRequest || resolveTrustedIdentityFromRequest;
  const identity = await resolveIdentity(req, options.authenticationOptions);

  if (!identity || typeof identity.trustedIdentityId !== "string" || !identity.trustedIdentityId) {
    return null;
  }
  if (identity.actorScope === "business-owner" || identity.actorScope === "demeos-admin") return null;

  return Object.freeze({
    trustedCustomerIdentityId: identity.trustedIdentityId,
    provider: identity.provider
  });
}

module.exports = { resolveTrustedCustomerIdentityFromRequest };
