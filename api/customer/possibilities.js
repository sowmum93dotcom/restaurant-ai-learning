const { getRepository } = require("../_lib/persistence.js");
const { DEMEOS_ACTOR_SCOPES, DEMEOS_ACTIONS, canPerformDemeosAction } = require("../_lib/demeos-rules.js");
const { findCustomerPossibilities, validateConfirmedUnderstanding } = require("../_lib/customer-possibility-contract.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!canPerformDemeosAction({
    actorScope: DEMEOS_ACTOR_SCOPES.PUBLIC_CUSTOMER,
    action: DEMEOS_ACTIONS.VIEW_CUSTOMER_EXPERIENCE
  })) return res.status(403).json({ error: "DEMEOS permission denied." });

  const understanding = validateConfirmedUnderstanding(req.body);
  if (!understanding) return res.status(400).json({ error: "A valid confirmed customer understanding is required." });
  try {
    const work = await getRepository().getCustomerWork();
    return res.status(200).json({ possibilities: findCustomerPossibilities(understanding, work) });
  } catch (error) {
    console.error("Could not prepare customer possibilities:", error);
    return res.status(500).json({ error: "DEMEOS could not prepare possibilities." });
  }
};
