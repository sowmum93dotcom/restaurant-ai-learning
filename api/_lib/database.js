const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS demeos_businesses (
    business_id TEXT PRIMARY KEY,
    profile JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_campaigns (
    campaign_id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    campaign JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_campaigns_business_id_idx
    ON demeos_campaigns (business_id)`
];

function createDatabase(client) {
  let initialization;

  async function ensureSchema() {
    if (!initialization) {
      initialization = (async function () {
        for (const statement of SCHEMA_STATEMENTS) await client.query(statement);
      })().catch(function (error) {
        initialization = null;
        throw error;
      });
    }
    await initialization;
  }

  return {
    ensureSchema,
    query: function (text, values) { return client.query(text, values); }
  };
}

let defaultDatabase;
function getDatabase() {
  if (!defaultDatabase) {
    const { sql } = require("@vercel/postgres");
    defaultDatabase = createDatabase(sql);
  }
  return defaultDatabase;
}

module.exports = { SCHEMA_STATEMENTS, createDatabase, getDatabase };
