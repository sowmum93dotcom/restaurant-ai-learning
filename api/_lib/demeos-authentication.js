function isProductionDeployment(environment = process.env) {
  return environment.VERCEL_ENV === "production";
}

function hasAllowedClerkKey(key, kind, environment = process.env) {
  if (typeof key !== "string" || !key.trim()) return false;
  if (!isProductionDeployment(environment)) return true;

  const value = key.trim();
  const developmentPrefix = `${kind}_test_`;
  const oppositeKind = kind === "pk" ? "sk" : "pk";

  // Production must never accept Clerk development credentials or a key of
  // the opposite type. Do not require one exact production prefix here:
  // Clerk remains the authority for validating the configured credential,
  // and this keeps DEMEOS compatible with provider-managed production values.
  if (value.startsWith(developmentPrefix)) return false;
  if (value.startsWith(`${oppositeKind}_`)) return false;
  return true;
}

function getAllowedClerkPublishableKey(environment = process.env) {
  const candidates = [
    environment.CLERK_PUBLISHABLE_KEY,
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ];
  for (const candidate of candidates) {
    if (hasAllowedClerkKey(candidate, "pk", environment)) return candidate.trim();
  }
  return null;
}

function hasRequiredClerkConfiguration(environment = process.env) {
  return hasAllowedClerkKey(environment.CLERK_SECRET_KEY, "sk", environment) &&
    Boolean(getAllowedClerkPublishableKey(environment));
}

function hasAllowedClerkPublishableKey(environment = process.env) {
  return Boolean(getAllowedClerkPublishableKey(environment));
}

function getClerkConfigurationStatus(environment = process.env) {
  const direct = environment.CLERK_PUBLISHABLE_KEY;
  const nextPublic = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (typeof direct !== "string" && typeof nextPublic !== "string") return "publishable-key-missing";
  if (!getAllowedClerkPublishableKey(environment)) return "publishable-key-invalid";
  return "ready";
}

function isRequestLike(req) {
  return Boolean(req && typeof req === "object" && req.headers && typeof req.headers === "object");
}

function appendHeaderValue(headers, name, value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") headers.append(name, item);
    }
    return;
  }
  if (typeof value === "string" || typeof value === "number") {
    headers.set(name, String(value));
  }
}

function getHeaderValue(req, name) {
  if (!req || !req.headers) return null;
  if (typeof req.headers.get === "function") return req.headers.get(name);
  const direct = req.headers[name];
  if (typeof direct === "string") return direct;
  if (Array.isArray(direct) && direct.length) return direct[0];
  return null;
}

function toClerkRequest(req) {
  if (!isRequestLike(req)) return null;
  if (typeof Request !== "undefined" && req instanceof Request) return req;
  if (typeof Request === "undefined" || typeof Headers === "undefined") return null;

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    appendHeaderValue(headers, name, value);
  }

  const host = getHeaderValue(req, "x-forwarded-host") || getHeaderValue(req, "host");
  if (!host) return null;
  const forwardedProto = getHeaderValue(req, "x-forwarded-proto");
  const protocol = forwardedProto ? forwardedProto.split(",")[0].trim() : "https";
  const path = typeof req.url === "string" && req.url.length ? req.url : "/";
  const method = typeof req.method === "string" && req.method.length ? req.method : "GET";

  try {
    const url = new URL(path, `${protocol}://${host}`).toString();
    return new Request(url, { method, headers });
  } catch (_error) {
    return null;
  }
}

function getClerkAuthenticateRequest() {
  const { createClerkClient } = require("@clerk/backend");
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: getAllowedClerkPublishableKey()
  });

  return clerkClient.authenticateRequest.bind(clerkClient);
}

async function resolveTrustedIdentityFromRequest(req, options = {}) {
  if (!hasRequiredClerkConfiguration()) return null;

  try {
    const clerkRequest = toClerkRequest(req);
    if (!clerkRequest) return null;

    const authenticateRequest = options.authenticateRequest || getClerkAuthenticateRequest();
    if (typeof authenticateRequest !== "function") return null;

    const requestState = await authenticateRequest(clerkRequest);
    if (!requestState || requestState.isAuthenticated !== true || typeof requestState.toAuth !== "function") {
      return null;
    }

    const authentication = requestState.toAuth();
    const userId = authentication && authentication.userId;
    if (typeof userId !== "string" || userId.length === 0) return null;

    const trusted = {
      trustedIdentityId: userId,
      provider: "clerk"
    };
    const providerRole = authentication.sessionClaims?.metadata?.role || authentication.sessionClaims?.publicMetadata?.role;
    if (["business-owner", "demeos-admin"].includes(providerRole)) trusted.actorScope = providerRole;
    return Object.freeze(trusted);
  } catch (_error) {
    return null;
  }
}

module.exports = {
  getAllowedClerkPublishableKey,
  getClerkConfigurationStatus,
  hasAllowedClerkPublishableKey,
  hasRequiredClerkConfiguration,
  resolveTrustedIdentityFromRequest
};
