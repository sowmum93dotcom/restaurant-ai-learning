const { getRepository } = require("../_lib/persistence.js");
const {
  DEMEOS_ACTOR_SCOPES,
  DEMEOS_ACTIONS,
  canPerformDemeosAction
} = require("../_lib/demeos-rules.js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!canPerformDemeosAction({
    actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
    action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE
  })) {
    return res.status(403).json({ error: "DEMEOS permission denied." });
  }
  try {
    return res.status(200).json({
      work: await getRepository().getCustomerWork(),
      // Customer package availability is server-owned. No package definitions exist yet.
      customerPackages: []
    });
  } catch (error) {
    console.error("Could not load customer work:", error);
    return res.status(500).json({ error: "DEMEOS could not load customer work." });
  }
};
