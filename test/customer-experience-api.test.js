const assert = require("node:assert/strict");
const test = require("node:test");

const persistencePath = require.resolve("../api/_lib/persistence.js");
const rulesPath = require.resolve("../api/_lib/demeos-rules.js");

function response() {
  return {
    statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function runHandler(handlerPath, repository, req, permissionCheck) {
  const persistence = require(persistencePath);
  const rules = require(rulesPath);
  const original = persistence.getRepository;
  const originalPermissionCheck = rules.canPerformDemeosAction;
  persistence.getRepository = function () { return repository; };
  if (permissionCheck) rules.canPerformDemeosAction = permissionCheck;
  delete require.cache[require.resolve(handlerPath)];
  const handler = require(handlerPath);
  const res = response();
  try { await handler(req, res); }
  finally {
    persistence.getRepository = original;
    rules.canPerformDemeosAction = originalPermissionCheck;
    delete require.cache[require.resolve(handlerPath)];
  }
  return res;
}

test("customer routes use only their server-defined public permissions", async function () {
  const checks = [];
  const permissionCheck = function (request) {
    checks.push(request);
    return request.actorScope === "public-customer" && [
      "view-customer-experience",
      "record-customer-participation"
    ].includes(request.action);
  };
  const hostileInput = {
    headers: { "x-actor-scope": "demeos-admin" },
    query: { actorScope: "business-owner" },
    body: { actorScope: "demeos-admin" },
    cookies: { actorScope: "business-owner" },
    localStorage: { actorScope: "demeos-admin" }
  };

  const getResponse = await runHandler("../api/customer/work.js", {
    async getCustomerWork() { return []; }
  }, { method: "GET", ...hostileInput }, permissionCheck);
  const postResponse = await runHandler("../api/customer/work/[campaignId]/participation.js", {
    async recordCustomerParticipation() { return { action: "Interested" }; }
  }, {
    method: "POST",
    ...hostileInput,
    query: { ...hostileInput.query, campaignId: "campaign-a" },
    body: { ...hostileInput.body, action: "Interested" }
  }, permissionCheck);

  assert.equal(getResponse.statusCode, 200);
  assert.equal(postResponse.statusCode, 201);
  assert.deepEqual(checks, [
    { actorScope: "public-customer", action: "view-customer-experience" },
    { actorScope: "public-customer", action: "record-customer-participation" }
  ]);
});

test("customer routes fail closed before accessing persistence", async function () {
  let repositoryCalled = false;
  const repository = {
    async getCustomerWork() { repositoryCalled = true; },
    async recordCustomerParticipation() { repositoryCalled = true; }
  };
  const deny = function () { return false; };

  const getResponse = await runHandler("../api/customer/work.js", repository,
    { method: "GET", query: { actorScope: "demeos-admin" } }, deny);
  const postResponse = await runHandler("../api/customer/work/[campaignId]/participation.js", repository, {
    method: "POST", query: { campaignId: "campaign-a" },
    body: { businessId: "business-a", action: "Interested", actorScope: "business-owner" }
  }, deny);

  assert.equal(repositoryCalled, false);
  assert.equal(getResponse.statusCode, 403);
  assert.deepEqual(getResponse.body, { error: "DEMEOS permission denied." });
  assert.equal(postResponse.statusCode, 403);
  assert.deepEqual(postResponse.body, { error: "DEMEOS permission denied." });
});

test("customer feed returns only the deliberately public work shape", async function () {
  const work = [{
    workItemId: "campaign-a", businessName: "North Star",
    location: "Leeds", content: "Come and see us.", participationAction: "Interested"
  }];
  const res = await runHandler("../api/customer/work.js", { async getCustomerWork() { return work; } }, { method: "GET" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { work });
  assert.deepEqual(Object.keys(res.body.work[0]).sort(), [
    "businessName", "content", "location", "participationAction", "workItemId"
  ]);
  assert.equal("businessId" in res.body.work[0], false);
  assert.doesNotMatch(JSON.stringify(res.body), /businessId/);
});

test("Interested uses the route campaign identity and exposes only the safe action", async function () {
  let received;
  const repository = {
    async recordCustomerParticipation(campaignId, action) {
      received = { campaignId, action };
      return { ...received };
    }
  };
  const res = await runHandler("../api/customer/work/[campaignId]/participation.js", repository, {
    method: "POST", query: { campaignId: "campaign-a" },
    body: { businessId: "spoofed-business", campaign: { businessId: "nested-spoof" }, action: "Interested" }
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(received, { campaignId: "campaign-a", action: "Interested" });
  assert.deepEqual(res.body, { participation: { action: "Interested" } });
});

test("unsupported actions and work that is not approved are rejected", async function () {
  let called = false;
  const invalid = await runHandler("../api/customer/work/[campaignId]/participation.js", {
    async recordCustomerParticipation() { called = true; }
  }, { method: "POST", query: { campaignId: "campaign-a" }, body: { action: "Pay" } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(called, false);

  const unavailable = await runHandler("../api/customer/work/[campaignId]/participation.js", {
    async recordCustomerParticipation() { return null; }
  }, { method: "POST", query: { campaignId: "campaign-a" }, body: { action: "Interested" } });
  assert.equal(unavailable.statusCode, 404);
  assert.deepEqual(unavailable.body, { error: "Approved DEMEOS work was not found." });
});

test("customer routes retain their method contracts", async function () {
  const getRoute = await runHandler("../api/customer/work.js", {}, { method: "POST" });
  assert.equal(getRoute.statusCode, 405);
  assert.equal(getRoute.headers.Allow, "GET");
  assert.deepEqual(getRoute.body, { error: "Method not allowed" });

  const participationRoute = await runHandler(
    "../api/customer/work/[campaignId]/participation.js", {}, { method: "GET" });
  assert.equal(participationRoute.statusCode, 405);
  assert.equal(participationRoute.headers.Allow, "POST");
  assert.deepEqual(participationRoute.body, { error: "Method not allowed" });
});

test("repository customer work fills public slots with the newest publishable approved campaigns", async function () {
  let sql;
  const row = function (campaignId, campaign) {
    return { campaign_id: campaignId, business_id: "business-a", campaign,
      profile: { name: "North Star", location: "Leeds", goal: "private" } };
  };
  const approvedSocial = function (campaignId) {
    return row(campaignId, { campaignType: "social", campaignText: `Content for ${campaignId}`,
      approvalStatus: "Approved", evidence: "private" });
  };
  const storedRows = [
    row("campaign-draft", { campaignType: "social", campaignText: "Draft", approvalStatus: "Unapproved" }),
    approvedSocial("campaign-newest-publishable"),
    ...Array.from({ length: 18 }, function (_, index) {
      return row(`campaign-unsupported-${index}`, {
        campaignType: "video", campaignText: "Video", approvalStatus: "Approved"
      });
    }),
    ...Array.from({ length: 20 }, function (_, index) {
      return approvedSocial(`campaign-publishable-${index + 1}`);
    })
  ];
  const repository = require("../api/_lib/persistence.js").createPersistenceRepository({
    async ensureSchema() {},
    async query(statement) {
      sql = statement;
      const approvedRows = storedRows.filter(function (storedRow) {
        return storedRow.campaign.approvalStatus === "Approved";
      });
      return { rows: /LIMIT 20/.test(statement) ? approvedRows.slice(0, 20) : approvedRows };
    }
  });
  const work = await repository.getCustomerWork();
  assert.match(sql, /JOIN demeos_businesses/);
  assert.match(sql, /approvalStatus.*Approved/);
  assert.match(sql, /ORDER BY c\.updated_at DESC/);
  assert.doesNotMatch(sql, /LIMIT 20/);
  assert.equal(work.length, 20);
  assert.deepEqual(work.map(function (item) { return item.workItemId; }), [
    "campaign-newest-publishable",
    ...Array.from({ length: 19 }, function (_, index) { return `campaign-publishable-${index + 1}`; })
  ]);
  assert.equal(work.some(function (item) { return item.workItemId === "campaign-draft"; }), false);
  work.forEach(function (item) {
    assert.deepEqual(Object.keys(item).sort(), [
      "businessName", "content", "location", "participationAction", "workItemId"
    ]);
    assert.equal("businessId" in item, false);
  });
});

test("repository resolves participation business identity from the approved stored campaign", async function () {
  const queries = [];
  const storedCampaign = {
    campaignType: "social", campaignText: "Join us this weekend", approvalStatus: "Approved"
  };
  const repository = require("../api/_lib/persistence.js").createPersistenceRepository({
    async ensureSchema() {},
    async query(statement, parameters) {
      queries.push({ statement, parameters });
      if (queries.length === 1) {
        return { rows: [{ business_id: "stored-business", campaign: storedCampaign }] };
      }
      return { rows: [{ business_id: "stored-business", campaign_id: "campaign-a",
        action: "Interested", participated_at: new Date() }] };
    }
  });

  const participation = await repository.recordCustomerParticipation("campaign-a", "Interested");

  assert.equal(participation.business_id, "stored-business");
  assert.match(queries[0].statement, /WHERE campaign_id = \$1/);
  assert.deepEqual(queries[0].parameters, ["campaign-a"]);
  assert.match(queries[1].statement, /SELECT c\.business_id, c\.campaign_id/);
  assert.doesNotMatch(queries[1].statement, /c\.business_id = \$/);
  assert.deepEqual(queries[1].parameters, ["campaign-a", "Interested", JSON.stringify(storedCampaign)]);
});

test("repository returns not found for unknown, unapproved, and non-publishable campaigns", async function () {
  const campaigns = [
    undefined,
    { business_id: "business-a", campaign: {
      campaignType: "social", campaignText: "Draft", approvalStatus: "Unapproved"
    } },
    { business_id: "business-a", campaign: {
      campaignType: "video", campaignText: "Unsupported", approvalStatus: "Approved"
    } }
  ];

  for (const stored of campaigns) {
    let queryCount = 0;
    const repository = require("../api/_lib/persistence.js").createPersistenceRepository({
      async ensureSchema() {},
      async query() {
        queryCount += 1;
        return { rows: stored ? [stored] : [] };
      }
    });
    const participation = await repository.recordCustomerParticipation("campaign-a", "Interested");
    assert.equal(participation, null);
    assert.equal(queryCount, 1);
  }
});
