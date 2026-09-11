const { resolveTrustedIdentityFromRequest } = require("./_lib/demeos-authentication.js");
const { getRepository } = require("./_lib/persistence.js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const identity = await resolveTrustedIdentityFromRequest(req);
  if (!identity) return res.status(401).json({ error: "Authentication required." });

  try {
    const businesses = await getRepository().getOwnedBusinessProfiles(identity.trustedIdentityId);
    return res.status(200).json({ businesses });
  } catch (error) {
    console.error("Could not list owner businesses:", error);
    return res.status(500).json({ error: "DEMEOS could not load your businesses." });
  }
};
