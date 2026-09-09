const persistence = require("./persistence.js");
const {
  createAuthenticatedBusinessOwnerContext,
  createUnresolvedActorContext
} = require("./demeos-actor-context.js");

function isValidIdentifier(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function resolveBusinessOwnerContext({
  trustedIdentityId,
  businessId,
  repository
} = {}) {
  if (!isValidIdentifier(trustedIdentityId) || !isValidIdentifier(businessId)) {
    return createUnresolvedActorContext();
  }

  try {
    const ownershipRepository = repository || persistence.getRepository();
    const ownsBusiness = await ownershipRepository.isBusinessOwnedByIdentity(
      trustedIdentityId,
      businessId
    );

    if (ownsBusiness !== true) return createUnresolvedActorContext();

    return createAuthenticatedBusinessOwnerContext({ trustedIdentityId, businessId });
  } catch (_error) {
    return createUnresolvedActorContext();
  }
}

module.exports = { resolveBusinessOwnerContext };
