const assert = require("node:assert/strict");
const test = require("node:test");
const { syncLocalPersistence } = require("../js/script");
const { createHandler: createCampaignHandler } = require("../api/campaigns");
const { createHandler: createBusinessHandler } = require("../api/businesses");

function memoryStorage(data) {
  const values = new Map(Object.entries(data || {}));
  return { getItem(key) { return values.get(key) || null; }, setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); } };
}

function persistenceServer() {
  const profiles = new Map();
  const campaigns = new Map();
  return {
    profiles, campaigns,
    async request(url, method, body) {
      if (url === "/api/businesses" && method === "POST") { profiles.set(body.businessId, { ...body }); return { profile: body }; }
      if (url === "/api/businesses" && method === "GET") return { profiles: Array.from(profiles.values()) };
      if (url === "/api/campaigns" && method === "POST") { campaigns.set(body.id, { ...body }); return { campaign: body }; }
      if (url.startsWith("/api/campaigns?") && method === "GET") {
        const businessId = decodeURIComponent(url.split("=")[1]);
        return { campaigns: Array.from(campaigns.values()).filter(function (item) { return item.businessId === businessId; }) };
      }
      throw new Error("Unexpected request");
    }
  };
}

test("local profiles and campaigns migrate idempotently with metadata and business isolation", async function () {
  const profiles = [
    { businessId: "a", name: "A", type: "Cafe", location: "A", brandVoice: "Warm", targetCustomer: "Local", goal: "Grow" },
    { businessId: "b", name: "B", type: "Bakery", location: "B", brandVoice: "Clear", targetCustomer: "Local", goal: "Grow" }
  ];
  const campaigns = [
    { id: "original", businessId: "a", campaignText: "Original", campaignType: "social", campaignTypeLabel: "Social", promoText: "P", businessName: "A", approvalStatus: "Approved", originalMarketingWorkId: "original", revisionNumber: 0, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "revision", businessId: "a", campaignText: "Revision", campaignType: "social", campaignTypeLabel: "Social", promoText: "P", businessName: "A", approvalStatus: "Unapproved", originalMarketingWorkId: "original", revisionNumber: 1, createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "business-b", businessId: "b", campaignText: "B", campaignType: "email", campaignTypeLabel: "Email", promoText: "P", businessName: "B", approvalStatus: "Approved", originalMarketingWorkId: "business-b", revisionNumber: 0, createdAt: "2026-01-03T00:00:00.000Z" }
  ];
  const storage = memoryStorage({ demeosBusinessProfiles: JSON.stringify(profiles), demeosActiveBusinessId: "a", demeosCampaignHistory: JSON.stringify(campaigns) });
  const server = persistenceServer();

  await syncLocalPersistence(storage, server.request);
  await syncLocalPersistence(storage, server.request);

  assert.equal(server.profiles.size, 2, "profile upserts never duplicate records");
  assert.equal(server.campaigns.size, 3, "campaign upserts never duplicate records");
  assert.deepEqual(Array.from(server.campaigns.values()).filter(function (item) { return item.businessId === "b"; }).map(function (item) { return item.id; }), ["business-b"]);
  assert.deepEqual(server.campaigns.get("revision"), campaigns[1]);
  assert.equal(server.campaigns.get("original").approvalStatus, "Approved");
});

test("a server failure leaves every localStorage value untouched", async function () {
  const initial = { demeosBusinessProfiles: JSON.stringify([{ businessId: "a", name: "A" }]), demeosActiveBusinessId: "a", demeosCampaignHistory: JSON.stringify([{ id: "c", businessId: "a" }]) };
  const storage = memoryStorage(initial);
  await assert.rejects(syncLocalPersistence(storage, async function () { throw new Error("offline"); }), /offline/);
  assert.equal(storage.getItem("demeosBusinessProfiles"), initial.demeosBusinessProfiles);
  assert.equal(storage.getItem("demeosCampaignHistory"), initial.demeosCampaignHistory);
  assert.equal(storage.getItem("demeosActiveBusinessId"), "a");
});

function responseRecorder() {
  return { statusCode: 0, payload: null, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } };
}

test("profile and campaign API handlers preserve scoped persistence and approval", async function () {
  const profiles = new Map(); const campaigns = new Map();
  const repository = {
    async listProfiles() { return Array.from(profiles.values()); },
    async upsertProfile(profile) { profiles.set(profile.businessId, profile); return profile; },
    async listCampaigns(id) { return Array.from(campaigns.values()).filter(function (item) { return item.businessId === id; }); },
    async upsertCampaign(campaign) { campaigns.set(campaign.id, campaign); return campaign; },
    async updateApproval(id, businessId, approvalStatus) { const value = campaigns.get(id); if (!value || value.businessId !== businessId) return null; value.approvalStatus = approvalStatus; return value; }
  };
  const profile = { businessId: "a", name: "A", type: "Cafe", location: "A", brandVoice: "Warm", targetCustomer: "Local", goal: "Grow" };
  let res = responseRecorder(); await createBusinessHandler(repository)({ method: "POST", body: profile }, res);
  assert.equal(res.statusCode, 200); assert.equal(profiles.get("a").name, "A");
  const campaign = { id: "c", businessId: "a", campaignText: "Text", campaignType: "social", campaignTypeLabel: "Social", businessName: "A", approvalStatus: "Unapproved", originalMarketingWorkId: "c", revisionNumber: 0, createdAt: "2026-01-01T00:00:00.000Z" };
  res = responseRecorder(); await createCampaignHandler(repository)({ method: "POST", body: campaign }, res);
  res = responseRecorder(); await createCampaignHandler(repository)({ method: "GET", query: { businessId: "b" } }, res);
  assert.deepEqual(res.payload.campaigns, []);
  res = responseRecorder(); await createCampaignHandler(repository)({ method: "PATCH", body: { id: "c", businessId: "a", approvalStatus: "Approved" } }, res);
  assert.equal(res.payload.campaign.approvalStatus, "Approved");
  res = responseRecorder(); await createCampaignHandler(repository)({ method: "PATCH", body: { id: "c", businessId: "b", approvalStatus: "Unapproved" } }, res);
  assert.equal(res.statusCode, 404); assert.equal(campaigns.get("c").approvalStatus, "Approved");
});
