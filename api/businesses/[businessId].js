const { getRepository } = require("../_lib/persistence.js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  if (!businessId) return res.status(400).json({ error: "A businessId is required." });

  try {
    if (req.method === "PUT") {
      const profile = req.body && req.body.businessProfile;
      const requiredFields = ["name", "type", "location", "brandVoice", "targetCustomer", "goal"];
      if (
        !profile ||
        typeof profile !== "object" ||
        Array.isArray(profile) ||
        requiredFields.some(function (field) {
          return typeof profile[field] !== "string" || !profile[field].trim();
        })
      ) {
        return res.status(400).json({
          error: "Please complete all Business Manager Profile fields before saving."
        });
      }
      await getRepository().saveBusiness({ ...profile, businessId });
      return res.status(204).end();
    }
    const record = await getRepository().getKnownBusiness(businessId);
    if (!record) return res.status(404).json({ error: "Business not found." });
    return res.status(200).json(record);
  } catch (error) {
    console.error("Could not restore known business:", error);
    return res.status(500).json({ error: "DEMEOS could not restore this business." });
  }
};
