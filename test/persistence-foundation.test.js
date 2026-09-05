const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const { SCHEMA_STATEMENTS, createDatabase, createPostgresDatabase } = require("../api/_lib/database.js");
const { createPersistenceRepository } = require("../api/_lib/persistence.js");
const {
  addPendingBusinessProfileSync, hydrateKnownBusiness, mergeKnownBusinessPersistence,
  readPendingBusinessProfileSyncIds, removePendingBusinessProfileSync
} = require("../js/script.js");

function memoryStorage(entries) {
  const values = new Map(entries || []);
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}

test("schema initialization is safe and idempotent", async function () {
  const statements = [];
  const database = createDatabase({ async query(statement) { statements.push(statement); return { rows: [] }; } });

  await Promise.all([database.ensureSchema(), database.ensureSchema(), database.ensureSchema()]);
  await database.ensureSchema();

  assert.equal(statements.length, SCHEMA_STATEMENTS.length);
  statements.forEach(function (statement) { assert.match(statement, /IF NOT EXISTS/); });
});

test("Vercel Postgres runtime uses a pool with the query text and values interface", async function () {
  const calls = [];
  const pool = {
    async query(text, values) {
      calls.push({ text, values });
      return { rows: [] };
    }
  };
  let poolsCreated = 0;
  const database = createPostgresDatabase({
    createPool() { poolsCreated += 1; return pool; }
  });

  const result = await database.query("SELECT profile FROM demeos_businesses WHERE business_id = $1", ["business-a"]);

  assert.equal(poolsCreated, 1);
  assert.deepEqual(calls, [{
    text: "SELECT profile FROM demeos_businesses WHERE business_id = $1",
    values: ["business-a"]
  }]);
  assert.deepEqual(result, { rows: [] });
});

test("repository restores an existing known business and only its campaigns", async function () {
  const queries = [];
  const database = {
    async ensureSchema() {},
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.startsWith("SELECT profile")) {
        return { rows: [{ profile: { businessId: "tampered", name: "Business A", goal: "Grow" } }] };
      }
      return { rows: [{ campaign: { id: "campaign-a", businessId: "tampered", campaignText: "A content" } }] };
    }
  };

  const restored = await createPersistenceRepository(database).getKnownBusiness("business-a");

  assert.deepEqual(restored.businessProfile, { businessId: "business-a", name: "Business A", goal: "Grow" });
  assert.deepEqual(restored.campaigns, [
    { id: "campaign-a", businessId: "business-a", campaignText: "A content" }
  ]);
  assert.deepEqual(queries.map(function (query) { return query.values; }), [["business-a"], ["business-a"]]);
  assert.match(queries[1].sql, /WHERE business_id = \$1/);
});

test("repository restores at most the newest 20 campaigns for the requested business", async function () {
  const storedCampaigns = Array.from({ length: 25 }, function (_, index) {
    return {
      businessId: "business-a",
      campaign: { id: `campaign-a-${index + 1}` },
      createdAt: index + 1
    };
  }).concat([
    { businessId: "business-b", campaign: { id: "campaign-b-26" }, createdAt: 26 }
  ]);
  const database = {
    async ensureSchema() {},
    async query(sql, values) {
      if (sql.startsWith("SELECT profile")) {
        return { rows: [{ profile: { name: "Business A" } }] };
      }
      assert.match(sql, /WHERE business_id = \$1 ORDER BY created_at DESC LIMIT 20/);
      return {
        rows: storedCampaigns
          .filter(function (record) { return record.businessId === values[0]; })
          .sort(function (left, right) { return right.createdAt - left.createdAt; })
          .slice(0, 20)
          .map(function (record) { return { campaign: record.campaign }; })
      };
    }
  };

  const restored = await createPersistenceRepository(database).getKnownBusiness("business-a");

  assert.equal(restored.campaigns.length, 20);
  assert.deepEqual(
    restored.campaigns.map(function (campaign) { return campaign.id; }),
    Array.from({ length: 20 }, function (_, index) { return `campaign-a-${25 - index}`; })
  );
  assert.equal(restored.campaigns.some(function (campaign) {
    return campaign.id.startsWith("campaign-b-");
  }), false);
});

test("repository restores every campaign when a business has fewer than 20", async function () {
  const database = {
    async ensureSchema() {},
    async query(sql) {
      if (sql.startsWith("SELECT profile")) return { rows: [{ profile: { name: "Business A" } }] };
      return {
        rows: [3, 2, 1].map(function (number) {
          return { campaign: { id: `campaign-a-${number}` } };
        })
      };
    }
  };

  const restored = await createPersistenceRepository(database).getKnownBusiness("business-a");

  assert.deepEqual(
    restored.campaigns.map(function (campaign) { return campaign.id; }),
    ["campaign-a-3", "campaign-a-2", "campaign-a-1"]
  );
});

test("hydration restores profile and complete campaign continuity fields", async function () {
  const storage = memoryStorage([
    ["demeosBusinessProfiles", JSON.stringify([{ businessId: "business-a", name: "Old A" }])],
    ["demeosCampaignHistory", "[]"]
  ]);
  const campaign = {
    id: "revision-a", businessId: "business-a", approvalStatus: "Approved",
    originalMarketingWorkId: "original-a", revisionNumber: 2, campaignText: "Restored content"
  };

  const result = await hydrateKnownBusiness(storage, "business-a", async function () {
    return { ok: true, async json() { return { businessProfile: { businessId: "business-a", name: "Restored A" }, campaigns: [campaign] }; } };
  });

  assert.equal(result.hydrated, true);
  assert.deepEqual(JSON.parse(storage.getItem("demeosBusinessProfiles"))[0], {
    businessId: "business-a", name: "Restored A"
  });
  assert.deepEqual(JSON.parse(storage.getItem("demeosCampaignHistory"))[0], campaign);
});

test("hydration preserves a profile with pending sync while restoring its campaigns", async function () {
  const localProfile = { businessId: "business-a", name: "Latest local A", goal: "Local goal" };
  const serverCampaign = { id: "campaign-a", businessId: "business-a", campaignText: "Server campaign" };
  const storage = memoryStorage([
    ["demeosBusinessProfiles", JSON.stringify([localProfile])],
    ["demeosCampaignHistory", "[]"],
    ["demeosPendingBusinessProfileSync", '["business-a"]']
  ]);

  const result = await hydrateKnownBusiness(storage, "business-a", async function () {
    return {
      ok: true,
      async json() {
        return {
          businessProfile: { businessId: "business-a", name: "Older server A", goal: "Server goal" },
          campaigns: [serverCampaign]
        };
      }
    };
  });

  assert.equal(result.hydrated, true);
  assert.deepEqual(JSON.parse(storage.getItem("demeosBusinessProfiles")), [localProfile]);
  assert.deepEqual(JSON.parse(storage.getItem("demeosCampaignHistory")), [serverCampaign]);
});

test("pending profile syncs support multiple businesses and remove only the successful business", function () {
  const storage = memoryStorage();

  addPendingBusinessProfileSync(storage, "business-a");
  addPendingBusinessProfileSync(storage, "business-b");
  addPendingBusinessProfileSync(storage, "business-a");
  assert.equal(storage.getItem("demeosPendingBusinessProfileSync"), '["business-a","business-b"]');

  removePendingBusinessProfileSync(storage, "business-a");
  assert.deepEqual(readPendingBusinessProfileSyncIds(storage), ["business-b"]);
  assert.equal(storage.getItem("demeosPendingBusinessProfileSync"), '["business-b"]');
});

test("pending profile sync reads missing, malformed, and non-array data as empty", function () {
  const storage = memoryStorage();
  assert.deepEqual(readPendingBusinessProfileSyncIds(storage), []);
  storage.setItem("demeosPendingBusinessProfileSync", "[malformed");
  assert.deepEqual(readPendingBusinessProfileSyncIds(storage), []);
  storage.setItem("demeosPendingBusinessProfileSync", JSON.stringify({ businessId: "business-a" }));
  assert.deepEqual(readPendingBusinessProfileSyncIds(storage), []);
});

test("legacy scalar pending sync protects its profile and migrates when updated", async function () {
  const localProfile = { businessId: "business-a", name: "Latest local A" };
  const storage = memoryStorage([
    ["demeosBusinessProfiles", JSON.stringify([localProfile])],
    ["demeosCampaignHistory", "[]"],
    ["demeosPendingBusinessProfileSync", "business-a"]
  ]);

  await hydrateKnownBusiness(storage, "business-a", async function () {
    return {
      ok: true,
      async json() { return { businessProfile: { businessId: "business-a", name: "Server A" }, campaigns: [] }; }
    };
  });
  assert.deepEqual(JSON.parse(storage.getItem("demeosBusinessProfiles")), [localProfile]);

  addPendingBusinessProfileSync(storage, "business-b");
  assert.equal(storage.getItem("demeosPendingBusinessProfileSync"), '["business-a","business-b"]');
});

test("Business Profile is marked before persistence resolves and a successful retry clears only its marker", async function () {
  class FakeElement {
    constructor() {
      this.listeners = {};
      this.value = "";
      this.textContent = "";
      this.hidden = false;
      this.disabled = false;
      this.classList = { toggle() {} };
    }
    addEventListener(eventName, listener) { this.listeners[eventName] = listener; }
    append() {}
    appendChild() {}
    prepend() {}
    scrollIntoView() {}
  }
  const elements = new Map();
  const document = {
    addEventListener(eventName, listener) {
      if (eventName === "DOMContentLoaded") this.ready = listener;
    },
    createElement() { return new FakeElement(); },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement());
      return elements.get(id);
    }
  };
  const profile = {
    businessId: "business-a", name: "Business A", type: "Cafe", location: "Cardiff",
    brandVoice: "Warm", targetCustomer: "Neighbours", goal: "Grow"
  };
  const storage = memoryStorage([
    ["demeosBusinessProfiles", JSON.stringify([profile])],
    ["demeosActiveBusinessId", profile.businessId]
  ]);
  let resolveFirstPersistence;
  const firstPersistence = new Promise(function (resolve) { resolveFirstPersistence = resolve; });
  const persistenceResults = [firstPersistence, Promise.resolve(true)];
  const persistenceCalls = [];

  vm.runInNewContext(fs.readFileSync(require.resolve("../js/script.js"), "utf8"), {
    alert() {}, console, document,
    fetch(url, options) {
      if (!options) return Promise.resolve({ ok: false });
      const result = persistenceResults.shift();
      persistenceCalls.push(url);
      return result.then(function (ok) { return { ok }; });
    },
    localStorage: storage, Math, setTimeout, window: {}
  });
  document.ready();

  const save = document.getElementById("save-business-profile-btn").listeners.click;
  document.getElementById("business-name").value = "New local A";
  const firstSave = save();
  assert.equal(storage.getItem("demeosPendingBusinessProfileSync"), '["business-a"]');
  await hydrateKnownBusiness(storage, "business-a", async function () {
    return {
      ok: true,
      async json() {
        return {
          businessProfile: { businessId: "business-a", name: "Older server A" },
          campaigns: [{ id: "server-campaign", businessId: "business-a" }]
        };
      }
    };
  });
  assert.equal(JSON.parse(storage.getItem("demeosBusinessProfiles"))[0].name, "New local A");
  assert.deepEqual(JSON.parse(storage.getItem("demeosCampaignHistory")), [
    { id: "server-campaign", businessId: "business-a" }
  ]);
  resolveFirstPersistence(false);
  await firstSave;
  assert.equal(storage.getItem("demeosPendingBusinessProfileSync"), '["business-a"]');

  addPendingBusinessProfileSync(storage, "business-b");
  await save();
  assert.deepEqual(persistenceCalls, ["/api/businesses/business-a", "/api/businesses/business-a"]);
  assert.equal(storage.getItem("demeosPendingBusinessProfileSync"), '["business-b"]');
});

test("hydration remains normal for a business outside the pending list", async function () {
  const storage = memoryStorage([
    ["demeosBusinessProfiles", JSON.stringify([
      { businessId: "business-a", name: "Local A" },
      { businessId: "business-b", name: "Local B" }
    ])],
    ["demeosCampaignHistory", "[]"],
    ["demeosPendingBusinessProfileSync", '["business-a"]']
  ]);

  await hydrateKnownBusiness(storage, "business-b", async function () {
    return {
      ok: true,
      async json() { return { businessProfile: { businessId: "business-b", name: "Server B" }, campaigns: [] }; }
    };
  });

  assert.equal(JSON.parse(storage.getItem("demeosBusinessProfiles"))[1].name, "Server B");
});

test("hydration merges into local changes made while the request is in flight", async function () {
  const storage = memoryStorage([
    ["demeosBusinessProfiles", JSON.stringify([{ businessId: "business-a", name: "Old A" }])],
    ["demeosCampaignHistory", "[]"]
  ]);
  let resolveResponse;
  const responsePending = new Promise(function (resolve) { resolveResponse = resolve; });
  const hydration = hydrateKnownBusiness(storage, "business-a", async function () { return responsePending; });

  storage.setItem("demeosBusinessProfiles", JSON.stringify([
    { businessId: "business-a", name: "New local A", localNote: "Keep me" },
    { businessId: "business-b", name: "New local B" }
  ]));
  storage.setItem("demeosCampaignHistory", JSON.stringify([
    { id: "new-local", businessId: "business-a", campaignText: "Keep this campaign" }
  ]));
  resolveResponse({
    ok: true,
    async json() {
      return { businessProfile: { businessId: "business-a", name: "Server A" }, campaigns: [] };
    }
  });
  await hydration;

  assert.deepEqual(JSON.parse(storage.getItem("demeosBusinessProfiles")), [
    { businessId: "business-a", name: "Server A", localNote: "Keep me" },
    { businessId: "business-b", name: "New local B" }
  ]);
  assert.deepEqual(JSON.parse(storage.getItem("demeosCampaignHistory")), [
    { id: "new-local", businessId: "business-a", campaignText: "Keep this campaign" }
  ]);
});

test("hydration does not write when the requested business is removed in flight", async function () {
  const storage = memoryStorage([
    ["demeosBusinessProfiles", JSON.stringify([{ businessId: "business-a", name: "Old A" }])],
    ["demeosCampaignHistory", "[]"]
  ]);
  let resolveResponse;
  const responsePending = new Promise(function (resolve) { resolveResponse = resolve; });
  const hydration = hydrateKnownBusiness(storage, "business-a", async function () { return responsePending; });
  const currentProfiles = JSON.stringify([{ businessId: "business-b", name: "Business B" }]);
  const currentCampaigns = JSON.stringify([{ id: "business-b-work", businessId: "business-b" }]);
  storage.setItem("demeosBusinessProfiles", currentProfiles);
  storage.setItem("demeosCampaignHistory", currentCampaigns);
  resolveResponse({
    ok: true,
    async json() {
      return {
        businessProfile: { businessId: "business-a", name: "Server A" },
        campaigns: [{ id: "stale-a", businessId: "business-a" }]
      };
    }
  });

  const result = await hydration;

  assert.deepEqual(result, { hydrated: false, reason: "unknown-business" });
  assert.equal(storage.getItem("demeosBusinessProfiles"), currentProfiles);
  assert.equal(storage.getItem("demeosCampaignHistory"), currentCampaigns);
});

test("Business A hydration ignores Business B records and preserves local legacy campaigns", function () {
  const legacy = { id: "legacy", campaignText: "Local-only legacy work", approvalStatus: "Approved" };
  const localA = { id: "same-a", businessId: "business-a", campaignText: "Old", approvalStatus: "Unapproved" };
  const merged = mergeKnownBusinessPersistence(
    [{ businessId: "business-a", name: "Local A" }, { businessId: "business-b", name: "Local B" }],
    [legacy, localA],
    "business-a",
    {
      businessProfile: { businessId: "business-a", name: "Server A" },
      campaigns: [
        { id: "same-a", businessId: "business-a", campaignText: "Server A content", approvalStatus: "Approved", originalMarketingWorkId: "root", revisionNumber: 1 },
        { id: "business-b-work", businessId: "business-b", campaignText: "Must not leak" }
      ]
    }
  );

  assert.equal(merged.profiles[1].name, "Local B");
  assert.strictEqual(merged.campaigns[0], legacy);
  assert.deepEqual(merged.campaigns.map(function (campaign) { return campaign.id; }), ["legacy", "same-a"]);
  assert.deepEqual(merged.campaigns[1], {
    id: "same-a", businessId: "business-a", campaignText: "Server A content",
    approvalStatus: "Approved", originalMarketingWorkId: "root", revisionNumber: 1
  });
});

test("server failure leaves the local workflow byte-for-byte intact", async function () {
  const profiles = JSON.stringify([{ businessId: "business-a", name: "Local A" }]);
  const campaigns = JSON.stringify([{ id: "legacy", campaignText: "Keep me" }]);
  const storage = memoryStorage([
    ["demeosBusinessProfiles", profiles], ["demeosCampaignHistory", campaigns]
  ]);

  const result = await hydrateKnownBusiness(storage, "business-a", async function () {
    return { ok: false, status: 503 };
  });

  assert.equal(result.hydrated, false);
  assert.equal(storage.getItem("demeosBusinessProfiles"), profiles);
  assert.equal(storage.getItem("demeosCampaignHistory"), campaigns);
});

test("hydration never requests a business that is not already known locally", async function () {
  const storage = memoryStorage([["demeosBusinessProfiles", "[]"]]);
  let requests = 0;
  const result = await hydrateKnownBusiness(storage, "business-b", async function () { requests += 1; });
  assert.equal(result.reason, "unknown-business");
  assert.equal(requests, 0);
});
