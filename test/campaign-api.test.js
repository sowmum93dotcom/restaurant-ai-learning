const assert = require("node:assert/strict");
const test = require("node:test");

const authorizationPath = require.resolve("../api/_lib/demeos-business-owner-authorization.js");
const persistencePath = require.resolve("../api/_lib/persistence.js");
const handlerPath = require.resolve("../api/businesses/[businessId]/campaigns/[campaignId].js");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    ended: false,
    headers: {},
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
    setHeader(name, value) { this.headers[name] = value; }
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

async function invoke({
  method = "PUT", businessId = "business-a", campaignId = "campaign-a",
  campaign = completeCampaign(), authenticated = true, allowed = true,
  createAllowed = allowed, approvedCampaign = { approvalStatus: "Approved" }
} = {}) {
  const authorization = require(authorizationPath);
  const persistence = require(persistencePath);
  const originalAuthorize = authorization.authorizeBusinessOwnerRequest;
  const originalGetRepository = persistence.getRepository;
  const authorizationCalls = [];
  const savedCampaigns = [];
  const approvalCalls = [];
  const repository = {
    async saveCampaign(savedCampaign) { savedCampaigns.push(savedCampaign); },
    async approveCampaign(approvedBusinessId, approvedCampaignId) {
      approvalCalls.push([approvedBusinessId, approvedCampaignId]);
      if (Array.isArray(approvedCampaign)) {
        return approvedCampaign[Math.min(approvalCalls.length - 1, approvedCampaign.length - 1)];
      }
      return approvedCampaign;
    }
  };
  authorization.authorizeBusinessOwnerRequest = async function (input) {
    authorizationCalls.push(input);
    const actionAllowed = input.action === "create-marketing" ? createAllowed : allowed;
    return { authenticated, allowed: actionAllowed };
  };
  persistence.getRepository = function () { return repository; };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  const request = {
    method,
    query: {
      businessId,
      campaignId,
      trustedIdentityId: "query-attacker",
      userId: "query-attacker"
    },
    body: {
      campaign,
      trustedIdentityId: "body-attacker",
      userId: "body-attacker",
      actorScope: "business-owner"
    },
    headers: {
      host: "demeos.test",
      "x-user-id": "header-attacker",
      "x-identity-id": "header-attacker",
      "x-actor-scope": "business-owner"
    },
    localStorage: { selectedBusiness: businessId, trustedIdentityId: "browser-attacker" }
  };
  const response = createResponse();

  try {
    await handler(request, response);
  } finally {
    authorization.authorizeBusinessOwnerRequest = originalAuthorize;
    persistence.getRepository = originalGetRepository;
    delete require.cache[handlerPath];
  }

  return { response, request, repository, authorizationCalls, savedCampaigns, approvalCalls };
}

test("unauthenticated campaign approval returns 401", async function () {
  const result = await invoke({
    campaign: completeCampaign({ approvalStatus: "Approved" }), authenticated: false, allowed: false
  });
  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.approvalCalls, []);
});

test("an authenticated non-owner cannot approve marketing", async function () {
  const result = await invoke({
    campaign: completeCampaign({ approvalStatus: "Approved" }), allowed: false
  });
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.approvalCalls, []);
});

test("an owner can approve their own stored campaign version", async function () {
  const result = await invoke({
    campaign: completeCampaign({
      approvalStatus: "Approved", id: "spoofed-id", businessId: "spoofed-business",
      originalMarketingWorkId: "spoofed-version"
    })
  });
  assert.equal(result.response.statusCode, 204);
  assert.equal(result.authorizationCalls[0].action, "approve-own-marketing");
  assert.equal(result.authorizationCalls[0].businessId, "business-a");
  assert.deepEqual(result.approvalCalls, [["business-a", "campaign-a"]]);
  assert.deepEqual(result.savedCampaigns, []);
});

test("approval retry restores a missing draft only through create-marketing permission", async function () {
  const campaign = completeCampaign({ approvalStatus: "Approved", id: "body-id", businessId: "body-business" });
  const result = await invoke({
    businessId: "business-a",
    campaignId: "campaign-a",
    campaign,
    approvedCampaign: [null, { approvalStatus: "Approved" }]
  });

  assert.equal(result.response.statusCode, 204);
  assert.deepEqual(result.authorizationCalls.map(function (call) { return call.action; }), [
    "approve-own-marketing", "create-marketing"
  ]);
  assert.deepEqual(result.approvalCalls, [
    ["business-a", "campaign-a"], ["business-a", "campaign-a"]
  ]);
  assert.deepEqual(result.savedCampaigns, [{
    ...campaign,
    id: "campaign-a",
    businessId: "business-a",
    approvalStatus: "Unapproved"
  }]);
});

test("approval retry cannot create a missing draft without create-marketing permission", async function () {
  const result = await invoke({
    campaign: completeCampaign({ approvalStatus: "Approved" }),
    approvedCampaign: null,
    allowed: true,
    createAllowed: false
  });

  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.authorizationCalls.map(function (call) { return call.action; }), [
    "approve-own-marketing", "create-marketing"
  ]);
  assert.deepEqual(result.approvalCalls, [["business-a", "campaign-a"]]);
  assert.deepEqual(result.savedCampaigns, []);
});

test("an owner cannot approve another business's campaign", async function () {
  const result = await invoke({
    businessId: "business-b", campaign: completeCampaign({ approvalStatus: "Approved" }), allowed: false
  });
  assert.equal(result.response.statusCode, 403);
  assert.equal(result.authorizationCalls[0].businessId, "business-b");
  assert.deepEqual(result.approvalCalls, []);
});

test("a wrong campaign and business combination fails safely", async function () {
  const campaign = completeCampaign({ approvalStatus: "Approved" });
  const result = await invoke({
    businessId: "business-a", campaignId: "campaign-from-business-b",
    campaign, approvedCampaign: null
  });
  assert.equal(result.response.statusCode, 404);
  assert.deepEqual(result.approvalCalls, [
    ["business-a", "campaign-from-business-b"],
    ["business-a", "campaign-from-business-b"]
  ]);
  assert.equal(result.savedCampaigns[0].businessId, "business-a");
  assert.equal(result.savedCampaigns[0].id, "campaign-from-business-b");
  assert.equal(result.savedCampaigns[0].approvalStatus, "Unapproved");
  assert.deepEqual(result.response.body, { error: "Campaign was not found for this business." });
});

test("spoofed approval identity and actorScope cannot bypass authorization", async function () {
  const result = await invoke({
    campaign: completeCampaign({ approvalStatus: "Approved" }), allowed: false
  });
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(Object.keys(result.authorizationCalls[0]).sort(), ["action", "businessId", "repository", "req"]);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "trustedIdentityId"), false);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "actorScope"), false);
  assert.deepEqual(result.approvalCalls, []);
});

test("campaign validation remains enforced before a stored version is approved", async function () {
  const result = await invoke({
    campaign: completeCampaign({ approvalStatus: "Approved", campaignText: " " })
  });
  assert.equal(result.response.statusCode, 400);
  assert.equal(result.authorizationCalls[0].action, "approve-own-marketing");
  assert.deepEqual(result.approvalCalls, []);
});

test("unauthenticated campaign creation returns 401", async function () {
  const result = await invoke({ authenticated: false, allowed: false });
  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.response.body, { error: "Authentication required." });
  assert.deepEqual(result.savedCampaigns, []);
});

test("an authenticated non-owner cannot create marketing", async function () {
  const result = await invoke({ authenticated: true, allowed: false });
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: "Forbidden." });
  assert.deepEqual(result.savedCampaigns, []);
});

test("an authenticated owner can create marketing for their own business", async function () {
  const campaign = completeCampaign();
  const result = await invoke({ campaign });

  assert.equal(result.response.statusCode, 204);
  assert.equal(result.response.ended, true);
  assert.deepEqual(result.savedCampaigns, [{ ...campaign, id: "campaign-a", businessId: "business-a" }]);
  assert.equal(result.authorizationCalls.length, 1);
  assert.equal(result.authorizationCalls[0].req, result.request);
  assert.equal(result.authorizationCalls[0].businessId, "business-a");
  assert.equal(result.authorizationCalls[0].action, "create-marketing");
  assert.equal(result.authorizationCalls[0].repository, result.repository);
});

test("an owner cannot create marketing for another business", async function () {
  const result = await invoke({ businessId: "business-b", allowed: false });
  assert.equal(result.response.statusCode, 403);
  assert.equal(result.authorizationCalls[0].businessId, "business-b");
  assert.deepEqual(result.savedCampaigns, []);
});

test("spoofed identity and actor scope claims are not passed as trusted authorization inputs", async function () {
  const result = await invoke({ allowed: false });
  assert.equal(result.response.statusCode, 403);
  assert.equal(result.authorizationCalls.length, 1);
  assert.equal(result.authorizationCalls[0].req, result.request);
  assert.deepEqual(Object.keys(result.authorizationCalls[0]).sort(), ["action", "businessId", "repository", "req"]);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "trustedIdentityId"), false);
  assert.equal(Object.hasOwn(result.authorizationCalls[0], "actorScope"), false);
  assert.deepEqual(result.savedCampaigns, []);
});

test("campaign validation still runs after authorization", async function () {
  const invalidCampaigns = [
    completeCampaign({ campaignText: " \n\t " }),
    completeCampaign({ approvalStatus: "Pending" }),
    { ...completeCampaign(), campaignTypeLabel: undefined }
  ];

  for (const campaign of invalidCampaigns) {
    const result = await invoke({ campaign });
    assert.equal(result.response.statusCode, 400);
    assert.deepEqual(result.response.body, { error: "DEMEOS received invalid campaign data." });
    assert.equal(result.authorizationCalls.length, 1);
    assert.deepEqual(result.savedCampaigns, []);
  }
});

test("the URL campaign and business IDs remain authoritative", async function () {
  const result = await invoke({
    businessId: "url-business",
    campaignId: "url-campaign",
    campaign: completeCampaign({ id: "body-campaign", businessId: "body-business" })
  });

  assert.equal(result.response.statusCode, 204);
  assert.equal(result.authorizationCalls[0].businessId, "url-business");
  assert.equal(result.savedCampaigns[0].id, "url-campaign");
  assert.equal(result.savedCampaigns[0].businessId, "url-business");
});

test("unsupported methods and missing route identifiers preserve existing responses", async function () {
  const unsupported = await invoke({ method: "POST" });
  assert.equal(unsupported.response.statusCode, 405);
  assert.deepEqual(unsupported.response.body, { error: "Method not allowed" });
  assert.equal(unsupported.response.headers.Allow, "PUT");
  assert.deepEqual(unsupported.authorizationCalls, []);

  for (const identifiers of [{ businessId: "" }, { campaignId: "" }]) {
    const invalid = await invoke(identifiers);
    assert.equal(invalid.response.statusCode, 400);
    assert.deepEqual(invalid.response.body, {
      error: "A businessId, campaignId, and campaign are required."
    });
    assert.deepEqual(invalid.authorizationCalls, []);
    assert.deepEqual(invalid.savedCampaigns, []);
  }
});
