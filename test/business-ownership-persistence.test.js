const assert = require("node:assert/strict");
const test = require("node:test");

const { SCHEMA_STATEMENTS } = require("../api/_lib/database.js");
const { createPersistenceRepository } = require("../api/_lib/persistence.js");

function ownershipDatabase(businessIds) {
  const businesses = new Set(businessIds);
  const owners = new Map();
  let initialized = 0;
  return {
    owners,
    get initialized() { return initialized; },
    async ensureSchema() { initialized += 1; },
    async query(sql, values) {
      const key = `${values[0]}\u0000${values[1] || ""}`;
      if (sql.startsWith("INSERT INTO demeos_business_owners")) {
        if (!businesses.has(values[1]) || owners.has(key)) return { rows: [] };
        const row = {
          trusted_identity_id: values[0], business_id: values[1],
          created_at: "2026-09-09T00:00:00.000Z"
        };
        owners.set(key, row);
        return { rows: [row] };
      }
      if (sql.includes("SELECT trusted_identity_id, business_id, created_at")) {
        return { rows: owners.has(key) ? [owners.get(key)] : [] };
      }
      if (sql.startsWith("SELECT business_id")) {
        return {
          rows: [...owners.values()]
            .filter(function (row) { return row.trusted_identity_id === values[0]; })
            .sort(function (left, right) { return left.business_id.localeCompare(right.business_id); })
        };
      }
      if (sql.startsWith("SELECT 1")) return { rows: owners.has(key) ? [{}] : [] };
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}

test("ownership schema uses the existing initializer with a composite key and business foreign key", function () {
  const statement = SCHEMA_STATEMENTS.find(function (sql) {
    return sql.includes("CREATE TABLE IF NOT EXISTS demeos_business_owners");
  });
  assert.ok(statement);
  assert.match(statement, /trusted_identity_id TEXT NOT NULL/);
  assert.match(statement, /business_id TEXT NOT NULL REFERENCES demeos_businesses\(business_id\)/);
  assert.match(statement, /created_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  assert.match(statement, /PRIMARY KEY \(trusted_identity_id, business_id\)/);
});

test("assignBusinessOwner stores an existing business and duplicate assignment is idempotent", async function () {
  const database = ownershipDatabase(["business-a"]);
  const repository = createPersistenceRepository(database);

  const first = await repository.assignBusinessOwner("identity-a", "business-a");
  const duplicate = await repository.assignBusinessOwner("identity-a", "business-a");

  assert.deepEqual(first, {
    trustedIdentityId: "identity-a", businessId: "business-a",
    createdAt: "2026-09-09T00:00:00.000Z"
  });
  assert.deepEqual(duplicate, first);
  assert.equal(database.owners.size, 1);
});

test("assignment rejects nonexistent businesses and missing identifiers", async function () {
  const database = ownershipDatabase(["business-a"]);
  const repository = createPersistenceRepository(database);

  assert.equal(await repository.assignBusinessOwner("identity-a", "missing-business"), null);
  assert.equal(await repository.assignBusinessOwner("", "business-a"), null);
  assert.equal(await repository.assignBusinessOwner("identity-a", "  "), null);
  assert.equal(database.owners.size, 0);
});

test("owned business lookup is isolated to the exact trusted identity", async function () {
  const database = ownershipDatabase(["business-a", "business-b", "business-c"]);
  const repository = createPersistenceRepository(database);
  await repository.assignBusinessOwner("identity-a", "business-b");
  await repository.assignBusinessOwner("identity-a", "business-a");
  await repository.assignBusinessOwner("identity-b", "business-c");

  assert.deepEqual(await repository.getOwnedBusinessIds("identity-a"), ["business-a", "business-b"]);
  assert.deepEqual(await repository.getOwnedBusinessIds("identity-b"), ["business-c"]);
  assert.deepEqual(await repository.getOwnedBusinessIds("identity-c"), []);
  assert.deepEqual(await repository.getOwnedBusinessIds(), []);
});

test("ownership check requires an exact identity and business mapping", async function () {
  const repository = createPersistenceRepository(ownershipDatabase(["business-a", "business-b"]));
  await repository.assignBusinessOwner("identity-a", "business-a");

  assert.equal(await repository.isBusinessOwnedByIdentity("identity-a", "business-a"), true);
  assert.equal(await repository.isBusinessOwnedByIdentity("identity-a", "business-b"), false);
  assert.equal(await repository.isBusinessOwnedByIdentity("identity-b", "business-a"), false);
  assert.equal(await repository.isBusinessOwnedByIdentity(undefined, "business-a"), false);
  assert.equal(await repository.isBusinessOwnedByIdentity("identity-a", undefined), false);
});

test("business and browser-controlled claims never create ownership", async function () {
  const database = ownershipDatabase(["business-a"]);
  const repository = createPersistenceRepository(database);
  const browserClaims = {
    businessId: "business-a", localStorage: "identity-a", actorScope: "owner",
    body: "identity-a", query: "identity-a", header: "identity-a", cookie: "identity-a"
  };

  assert.equal(await repository.isBusinessOwnedByIdentity(undefined, browserClaims.businessId), false);
  assert.deepEqual(await repository.getOwnedBusinessIds(browserClaims), []);
  assert.equal(await repository.assignBusinessOwner(browserClaims, browserClaims.businessId), null);
  assert.equal(database.owners.size, 0);
});
