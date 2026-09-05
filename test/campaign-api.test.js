const assert = require("node:assert/strict");
const test = require("node:test");

const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId]/campaigns/[campaignId].js");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    ended: false,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

function completeCampaign(overrides) {
  return {
    campaignText: "Join us for dinner tonight.",
    campaignType: "social",
    campaignTypeLabel: "Social post",
    businessName: "DEMEOS Kitchen",
    createdAt: "2026-09-05T12:00:00.000Z",
    approvalStatus: "Unapproved",
    ...overrides
  };
}

async function putCampaign(businessId, campaignId, campaign) {
  const savedCampaigns = [];
  const originalGetRepository = require(persistencePath).getRepository;
  require(persistencePath).getRepository = function () {
    return {
      async saveCampaign(savedCampaign) {
        savedCampaigns.push(savedCampaign);
      }
    };
  };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  const response = createResponse();

  try {
    await handler({ method: "PUT", query: { businessId, campaignId }, body: { campaign } }, response);
  } finally {
    require(persistencePath).getRepository = originalGetRepository;
    delete require.cache[handlerPath];
  }

  return { response, savedCampaigns };
}

test("a complete valid campaign is accepted", async function () {
  const campaign = completeCampaign();
  const result = await putCampaign("business-a", "campaign-a", campaign);

  assert.equal(result.response.statusCode, 204);
  assert.equal(result.response.ended, true);
  assert.deepEqual(result.savedCampaigns, [{ ...campaign, id: "campaign-a", businessId: "business-a" }]);
});

test("a campaign with a missing required field is rejected", async function () {
  const campaign = completeCampaign();
  delete campaign.campaignTypeLabel;

  const result = await putCampaign("business-a", "campaign-a", campaign);

  assert.equal(result.response.statusCode, 400);
  assert.deepEqual(result.response.body, { error: "DEMEOS received invalid campaign data." });
  assert.deepEqual(result.savedCampaigns, []);
});

test("a campaign with a whitespace-only required field is rejected", async function () {
  const result = await putCampaign("business-a", "campaign-a", completeCampaign({ campaignText: " \n\t " }));

  assert.equal(result.response.statusCode, 400);
  assert.deepEqual(result.response.body, { error: "DEMEOS received invalid campaign data." });
  assert.deepEqual(result.savedCampaigns, []);
});

test("a campaign with an invalid approvalStatus is rejected", async function () {
  const result = await putCampaign("business-a", "campaign-a", completeCampaign({ approvalStatus: "Pending" }));

  assert.equal(result.response.statusCode, 400);
  assert.deepEqual(result.response.body, { error: "DEMEOS received invalid campaign data." });
  assert.deepEqual(result.savedCampaigns, []);
});

test("the URL campaignId remains authoritative", async function () {
  const result = await putCampaign("business-a", "url-campaign", completeCampaign({ id: "body-campaign" }));

  assert.equal(result.response.statusCode, 204);
  assert.equal(result.savedCampaigns[0].id, "url-campaign");
});

test("the URL businessId remains authoritative", async function () {
  const result = await putCampaign("url-business", "campaign-a", completeCampaign({ businessId: "body-business" }));

  assert.equal(result.response.statusCode, 204);
  assert.equal(result.savedCampaigns[0].businessId, "url-business");
});
