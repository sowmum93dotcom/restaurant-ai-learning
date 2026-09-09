const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS demeos_businesses (
    business_id TEXT PRIMARY KEY,
    profile JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_business_owners (
    trusted_identity_id TEXT NOT NULL,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (trusted_identity_id, business_id)
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_campaigns (
    campaign_id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    campaign JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_campaigns_business_id_idx
    ON demeos_campaigns (business_id)`,
  `CREATE TABLE IF NOT EXISTS demeos_recommendation_decisions (
    decision_id BIGSERIAL PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    recommendation_title TEXT NOT NULL,
    suggested_campaign_type TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('used', 'modified', 'rejected')),
    decided_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_recommendation_decisions_business_id_idx
    ON demeos_recommendation_decisions (business_id)`,
  `CREATE TABLE IF NOT EXISTS demeos_customer_participations (
    participation_id BIGSERIAL PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    campaign_id TEXT NOT NULL REFERENCES demeos_campaigns(campaign_id),
    action TEXT NOT NULL CHECK (action IN ('Interested')),
    participated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_participations_work_idx
    ON demeos_customer_participations (business_id, campaign_id)`
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
function createPostgresDatabase(postgres) {
  return createDatabase(postgres.createPool());
}

function getDatabase() {
  if (!defaultDatabase) {
    defaultDatabase = createPostgresDatabase(require("@vercel/postgres"));
  }
  return defaultDatabase;
}

module.exports = { SCHEMA_STATEMENTS, createDatabase, createPostgresDatabase, getDatabase };
