const assert = require("node:assert/strict");
const test = require("node:test");

const { createCampaignPersistenceQueue } = require("../js/script.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise(function (resolvePromise, rejectPromise) {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("two persistence writes for the same campaign are serialized", async function () {
  const firstRequest = deferred();
  const firstRequestStarted = deferred();
  const calls = [];
  const persistCampaign = createCampaignPersistenceQueue(async function (_, campaign) {
    calls.push(campaign.approvalStatus);
    if (campaign.approvalStatus === "Unapproved") {
      firstRequestStarted.resolve();
      await firstRequest.promise;
    }
  });

  const first = persistCampaign({}, { id: "campaign-a", approvalStatus: "Unapproved" });
  const second = persistCampaign({}, { id: "campaign-a", approvalStatus: "Approved" });
  await firstRequestStarted.promise;

  assert.deepEqual(calls, ["Unapproved"]);
  firstRequest.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(calls, ["Unapproved", "Approved"]);
});

test("Unapproved then Approved persists in request order when the first write is delayed", async function () {
  const firstRequest = deferred();
  const persistedStatuses = [];
  const persistCampaign = createCampaignPersistenceQueue(async function (_, campaign) {
    if (campaign.approvalStatus === "Unapproved") await firstRequest.promise;
    persistedStatuses.push(campaign.approvalStatus);
  });
  const campaign = { id: "campaign-a", approvalStatus: "Unapproved" };

  const unapproved = persistCampaign({}, campaign);
  campaign.approvalStatus = "Approved";
  const approved = persistCampaign({}, campaign);
  firstRequest.resolve();
  await Promise.all([unapproved, approved]);

  assert.deepEqual(persistedStatuses, ["Unapproved", "Approved"]);
});

test("different campaign IDs persist independently", async function () {
  const campaignARequest = deferred();
  const completed = [];
  const persistCampaign = createCampaignPersistenceQueue(async function (_, campaign) {
    if (campaign.id === "campaign-a") await campaignARequest.promise;
    completed.push(campaign.id);
  });

  const campaignA = persistCampaign({}, { id: "campaign-a" });
  const campaignB = persistCampaign({}, { id: "campaign-b" });
  await campaignB;

  assert.deepEqual(completed, ["campaign-b"]);
  campaignARequest.resolve();
  await campaignA;
});

test("a failed write does not block a later write for the same campaign", async function () {
  const calls = [];
  const persistCampaign = createCampaignPersistenceQueue(async function (_, campaign) {
    calls.push(campaign.approvalStatus);
    if (campaign.approvalStatus === "Unapproved") throw new Error("network failure");
  });

  const failed = persistCampaign({}, { id: "campaign-a", approvalStatus: "Unapproved" });
  const later = persistCampaign({}, { id: "campaign-a", approvalStatus: "Approved" });

  await assert.rejects(failed, /network failure/);
  await later;
  assert.deepEqual(calls, ["Unapproved", "Approved"]);
});
