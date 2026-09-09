const persistence = require("../_lib/persistence.js");
const {
  resolveTrustedIdentityFromRequest
} = require("../_lib/demeos-authentication.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.DEMEOS_OWNER_BOOTSTRAP_ENABLED !== "true") {
    return res.status(404).json({ error: "Not found." });
  }

  const authenticatedIdentity = await resolveTrustedIdentityFromRequest(req);
  if (!authenticatedIdentity) {
    return res.status(401).json({ error: "Authentication required." });
  }
  const { trustedIdentityId } = authenticatedIdentity;

  const businessId = req.body && typeof req.body.businessId === "string"
    ? req.body.businessId.trim()
    : "";
  if (!businessId) return res.status(400).json({ error: "A businessId is required." });

  try {
    const assignment = await persistence.getRepository().assignBusinessOwner(
      trustedIdentityId,
      businessId
    );
    if (!assignment) return res.status(404).json({ error: "Business not found." });

    return res.status(200).json({ businessId, ownershipAssigned: true });
  } catch (error) {
    console.error("Could not bootstrap business ownership:", error);
    return res.status(500).json({ error: "DEMEOS could not assign business ownership." });
  }
};
