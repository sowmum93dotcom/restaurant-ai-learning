function hasRequiredClerkConfiguration() {
  return Boolean(
    typeof process.env.CLERK_SECRET_KEY === "string" &&
    process.env.CLERK_SECRET_KEY.length > 0 &&
    typeof process.env.CLERK_PUBLISHABLE_KEY === "string" &&
    process.env.CLERK_PUBLISHABLE_KEY.length > 0
  );
}

function isRequestLike(req) {
  return Boolean(req && typeof req === "object" && req.headers && typeof req.headers === "object");
}

function getClerkAuthenticateRequest() {
  const { createClerkClient } = require("@clerk/backend");
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY
  });

  return clerkClient.authenticateRequest.bind(clerkClient);
}

async function resolveTrustedIdentityFromRequest(req, options = {}) {
  if (!hasRequiredClerkConfiguration() || !isRequestLike(req)) return null;

  try {
    const authenticateRequest = options.authenticateRequest || getClerkAuthenticateRequest();
    if (typeof authenticateRequest !== "function") return null;

    const requestState = await authenticateRequest(req);
    if (!requestState || requestState.isSignedIn !== true || typeof requestState.toAuth !== "function") {
      return null;
    }

    const authentication = requestState.toAuth();
    const userId = authentication && authentication.userId;
    if (typeof userId !== "string" || userId.length === 0) return null;

    return Object.freeze({
      trustedIdentityId: userId,
      provider: "clerk"
    });
  } catch (_error) {
    return null;
  }
}

module.exports = { resolveTrustedIdentityFromRequest };
