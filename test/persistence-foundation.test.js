const assert = require("node:assert/strict");
const test = require("node:test");

const { SCHEMA_STATEMENTS, createDatabase, createPostgresDatabase } = require("../api/_lib/database.js");
const { createPersistenceRepository } = require("../api/_lib/persistence.js");
const { hydrateKnownBusiness, mergeKnownBusinessPersistence } = require("../js/script.js");

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
