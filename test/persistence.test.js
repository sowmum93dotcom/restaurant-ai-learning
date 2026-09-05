"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createBusinessHandler,
  createCampaignHandler,
  migrateKnownBusiness
} = require("../api/_persistence");
const { persistKnownBusiness } = require("../js/script");

function memoryRepository() {
  const businesses = new Map();
  const campaigns = new Map();
  return {
    businesses,
    campaigns,
    async getBusiness(id) { return businesses.get(id) || null; },
    async saveBusiness(business) { businesses.set(business.businessId, { ...business }); return business; },
    async getCampaigns(businessId) {
      return Array.from(campaigns.values()).filter(function (campaign) { return campaign.businessId === businessId; });
    },
    async saveCampaign(campaign, businessId) {
      const existing = campaigns.get(campaign.id);
      if (existing && existing.businessId !== businessId) return existing;
      campaigns.set(campaign.id, { ...campaign });
      return campaign;
    }
  };
}

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("GET /api/businesses cannot enumerate all businesses", async function () {
  const repo = memoryRepository();
  await repo.saveBusiness({ businessId: "a", name: "A" });
  await repo.saveBusiness({ businessId: "b", name: "B" });
  const res = response();

  await createBusinessHandler(repo)({ method: "GET", query: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "businessId is required." });
  assert.equal(Array.isArray(res.body), false);
});

test("Business A persistence requests cannot retrieve Business B", async function () {
  const repo = memoryRepository();
  await repo.saveBusiness({ businessId: "a", name: "A" });
  await repo.saveBusiness({ businessId: "b", name: "B" });
  const res = response();

  await createBusinessHandler(repo)({ method: "GET", query: { businessId: "a" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { business: { businessId: "a", name: "A" } });
  assert.doesNotMatch(JSON.stringify(res.body), /"B"/);
});

test("campaign reads and writes are explicitly business-scoped", async function () {
  const repo = memoryRepository();
  await repo.saveCampaign({ id: "a-1", businessId: "a", campaignText: "A" }, "a");
  await repo.saveCampaign({ id: "b-1", businessId: "b", campaignText: "B" }, "b");
  const handler = createCampaignHandler(repo);
  const read = response();
  await handler({ method: "GET", query: { businessId: "a" } }, read);
  assert.deepEqual(read.body.campaigns.map(function (item) { return item.id; }), ["a-1"]);

  const mismatchedWrite = response();
  await handler({ method: "PUT", query: { businessId: "a" }, body: {
    businessId: "a", campaign: { id: "b-2", businessId: "b" }
  } }, mismatchedWrite);
  assert.equal(mismatchedWrite.statusCode, 400);
  assert.equal(repo.campaigns.has("b-2"), false);
});

test("migration leaves unowned legacy campaigns local and preserves owned campaign fields", async function () {
  const repo = memoryRepository();
  const legacy = { id: "legacy", campaignText: "Local history", approvalStatus: "Approved" };
  const owned = {
    id: "owned", businessId: "a", approvalStatus: "Approved",
    originalMarketingWorkId: "original", revisionNumber: 3
  };
  const localCampaigns = [legacy, owned];

  const result = await migrateKnownBusiness(repo, {
    businessId: "a", business: { businessId: "a", name: "A" }, campaigns: localCampaigns
  });

  assert.deepEqual(result.migratedCampaignIds, ["owned"]);
  assert.equal(repo.campaigns.has("legacy"), false);
  assert.deepEqual(localCampaigns, [legacy, owned], "existing local records remain untouched");
  assert.deepEqual(repo.campaigns.get("owned"), owned);
});

test("repeated migration is idempotent and creates no duplicates", async function () {
  const repo = memoryRepository();
  const payload = {
    businessId: "a",
    business: { businessId: "a", name: "A" },
    campaigns: [{ id: "campaign", businessId: "a", approvalStatus: "Approved",
      originalMarketingWorkId: "campaign", revisionNumber: 0 }]
  };

  await migrateKnownBusiness(repo, payload);
  await migrateKnownBusiness(repo, payload);

  assert.equal(repo.businesses.size, 1);
  assert.equal(repo.campaigns.size, 1);
  assert.deepEqual(repo.campaigns.get("campaign"), payload.campaigns[0]);
});

test("unavailable database leaves the complete localStorage payload unchanged", async function () {
  const profile = { businessId: "a", name: "A" };
  const campaigns = [
    { id: "owned", businessId: "a", approvalStatus: "Approved" },
    { id: "legacy", campaignText: "Keep me local" },
    { id: "other", businessId: "b" }
  ];
  const before = JSON.stringify({ profile, campaigns });

  const persisted = await persistKnownBusiness(profile, campaigns, async function () {
    throw new Error("database unavailable");
  });

  assert.equal(persisted, false);
  assert.equal(JSON.stringify({ profile, campaigns }), before);
});
