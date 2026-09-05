"use strict";

function send(res, status, body) {
  res.status(status).json(body);
}

function suppliedBusinessId(req) {
  const queryId = req.query && req.query.businessId;
  const bodyId = req.body && req.body.businessId;
  if (queryId && bodyId && queryId !== bodyId) return null;
  return queryId || bodyId || null;
}

function createBusinessHandler(repository) {
  return async function businessHandler(req, res) {
    const businessId = suppliedBusinessId(req);
    if (!businessId) return send(res, 400, { error: "businessId is required." });

    if (req.method === "GET") {
      const business = await repository.getBusiness(businessId);
      return business ? send(res, 200, { business }) : send(res, 404, { error: "Business not found." });
    }
    if (req.method === "PUT") {
      const business = req.body && req.body.business;
      if (!business || (business.businessId && business.businessId !== businessId)) {
        return send(res, 400, { error: "Business must match the supplied businessId." });
      }
      return send(res, 200, { business: await repository.saveBusiness({ ...business, businessId }) });
    }
    return send(res, 405, { error: "Method not allowed." });
  };
}

function createCampaignHandler(repository) {
  return async function campaignHandler(req, res) {
    const businessId = suppliedBusinessId(req);
    if (!businessId) return send(res, 400, { error: "businessId is required." });

    if (req.method === "GET") {
      return send(res, 200, { campaigns: await repository.getCampaigns(businessId) });
    }
    if (req.method === "PUT") {
      const campaign = req.body && req.body.campaign;
      if (!campaign || !campaign.id || campaign.businessId !== businessId) {
        return send(res, 400, { error: "Campaign must have an id and match the supplied businessId." });
      }
      return send(res, 200, { campaign: await repository.saveCampaign(campaign, businessId) });
    }
    return send(res, 405, { error: "Method not allowed." });
  };
}

async function migrateKnownBusiness(repository, payload) {
  const businessId = payload && payload.businessId;
  const business = payload && payload.business;
  const campaigns = payload && Array.isArray(payload.campaigns) ? payload.campaigns : [];
  if (!businessId || !business || (business.businessId && business.businessId !== businessId)) {
    throw new Error("A matching businessId and business are required.");
  }

  await repository.saveBusiness({ ...business, businessId });
  const migratedCampaignIds = [];
  for (const campaign of campaigns) {
    // Unowned legacy work is deliberately left in localStorage. Ownership must
    // never be inferred from whichever profile happens to be active.
    if (!campaign || !campaign.id || campaign.businessId !== businessId) continue;
    await repository.saveCampaign({ ...campaign }, businessId);
    migratedCampaignIds.push(campaign.id);
  }
  return { businessId, migratedCampaignIds };
}

function createMigrationHandler(repository) {
  return async function migrationHandler(req, res) {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
    try {
      return send(res, 200, await migrateKnownBusiness(repository, req.body));
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
  };
}

module.exports = { createBusinessHandler, createCampaignHandler, createMigrationHandler, migrateKnownBusiness };
