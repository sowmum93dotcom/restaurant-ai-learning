function publicConfig(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  if (typeof clerkPublishableKey !== "string" || !clerkPublishableKey.trim()) {
    return res.status(503).json({ error: "Authentication configuration is unavailable." });
  }

  // This endpoint is intentionally restricted to configuration safe for any browser.
  return res.status(200).json({ clerkPublishableKey: clerkPublishableKey.trim() });
}

module.exports = publicConfig;
