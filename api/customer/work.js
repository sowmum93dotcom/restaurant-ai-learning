const { getRepository } = require("../_lib/persistence.js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    return res.status(200).json({ work: await getRepository().getCustomerWork() });
  } catch (error) {
    console.error("Could not load customer work:", error);
    return res.status(500).json({ error: "DEMEOS could not load customer work." });
  }
};
