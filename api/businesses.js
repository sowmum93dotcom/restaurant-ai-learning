const { createRepository } = require("../lib/database");
const { persistenceError, sendError } = require("../lib/http");

function createHandler(repository) {
  return async function handler(req, res) {
    const persistence = repository || createRepository();
    try {
      if (req.method === "GET") return res.status(200).json({ profiles: await persistence.listProfiles() });
      if (req.method !== "POST" && req.method !== "PUT") return sendError(res, 405, "Method not allowed");
      const profile = req.body || {};
      const fields = ["businessId", "name", "type", "location", "brandVoice", "targetCustomer", "goal"];
      if (fields.some(function (field) { return typeof profile[field] !== "string" || !profile[field].trim(); })) {
        return sendError(res, 400, "A complete Business Manager Profile is required.");
      }
      return res.status(200).json({ profile: await persistence.upsertProfile(profile) });
    } catch (error) { return persistenceError(res, error); }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
