const { createRepository } = require("../lib/database");
const { persistenceError, sendError } = require("../lib/http");

function createHandler(repository) {
  return async function handler(req, res) {
    const persistence = repository || createRepository();
    try {
      if (req.method === "GET") {
        if (typeof req.query.businessId !== "string" || !req.query.businessId) return sendError(res, 400, "A business is required.");
        return res.status(200).json({ campaigns: await persistence.listCampaigns(req.query.businessId) });
      }
      if (req.method === "PATCH") {
        const { id, businessId, approvalStatus } = req.body || {};
        if (!id || !businessId || !["Approved", "Unapproved"].includes(approvalStatus)) return sendError(res, 400, "A valid campaign approval update is required.");
        const campaign = await persistence.updateApproval(id, businessId, approvalStatus);
        return campaign ? res.status(200).json({ campaign }) : sendError(res, 404, "Campaign not found for this business.");
      }
      if (req.method !== "POST") return sendError(res, 405, "Method not allowed");
      const campaign = req.body || {};
      const fields = ["id", "businessId", "campaignText", "campaignType", "campaignTypeLabel", "businessName", "approvalStatus", "originalMarketingWorkId", "createdAt"];
      if (fields.some(function (field) { return typeof campaign[field] !== "string" || !campaign[field]; }) ||
        !["Approved", "Unapproved"].includes(campaign.approvalStatus) || !Number.isInteger(campaign.revisionNumber) || campaign.revisionNumber < 0) {
        return sendError(res, 400, "A complete campaign record is required.");
      }
      return res.status(200).json({ campaign: await persistence.upsertCampaign(campaign) });
    } catch (error) { return persistenceError(res, error); }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
