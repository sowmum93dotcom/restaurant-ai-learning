const {
  resolveTrustedCustomerIdentityFromRequest
} = require("./_lib/demeos-customer-authentication.js");

function isCustomerIdentityRequest(req) {
  return req?.query?.resource === "customer-identity" ||
    (typeof req?.url === "string" && req.url.startsWith("/api/customer/identity"));
}

async function publicConfig(req, res) {
  res.setHeader("Cache-Control", "no-store");
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
