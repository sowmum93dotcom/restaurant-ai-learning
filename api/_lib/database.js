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
    trusted_customer_identity_id TEXT NULL,
    action TEXT NOT NULL CHECK (action IN ('Interested')),
    participated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE demeos_customer_participations
    ADD COLUMN IF NOT EXISTS trusted_customer_identity_id TEXT NULL`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_participations_work_idx
    ON demeos_customer_participations (business_id, campaign_id)`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_participations_owner_participated_idx
    ON demeos_customer_participations
      (trusted_customer_identity_id, participated_at DESC, participation_id DESC)`,
  `CREATE TABLE IF NOT EXISTS demeos_customer_feedback (
    feedback_id BIGSERIAL PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    campaign_id TEXT NOT NULL REFERENCES demeos_campaigns(campaign_id),
    feedback_type TEXT NOT NULL CHECK (feedback_type = 'possibility-relevance'),
    response TEXT NOT NULL CHECK (response IN ('Relevant', 'Not quite', 'Something different')),
    comment TEXT CHECK (comment IS NULL OR CHAR_LENGTH(comment) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE demeos_customer_feedback
    ADD COLUMN IF NOT EXISTS trusted_customer_identity_id TEXT NULL`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_feedback_work_idx
    ON demeos_customer_feedback (business_id, campaign_id)`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_feedback_owner_created_idx
    ON demeos_customer_feedback
      (trusted_customer_identity_id, created_at DESC, feedback_id DESC)`,
  `CREATE TABLE IF NOT EXISTS demeos_customer_intentions (
    intention_id BIGSERIAL PRIMARY KEY,
    trusted_customer_identity_id TEXT NOT NULL,
    intention_category TEXT NOT NULL,
    customer_text TEXT,
    confirmed_understanding TEXT NOT NULL,
    evidence_type TEXT NOT NULL CHECK (evidence_type = 'customer-confirmed-intention'),
    source TEXT NOT NULL CHECK (source = 'authenticated-customer'),
    confirmation_state TEXT NOT NULL CHECK (confirmation_state = 'confirmed'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_intentions_owner_created_idx
    ON demeos_customer_intentions (trusted_customer_identity_id, created_at DESC, intention_id DESC)`,
  `CREATE TABLE IF NOT EXISTS demeos_customer_possibility_issuances (
    trusted_customer_identity_id TEXT NOT NULL,
    work_item_id TEXT NOT NULL REFERENCES demeos_campaigns(campaign_id),
    campaign_snapshot JSONB NOT NULL,
    evidence_type TEXT NOT NULL CHECK (evidence_type = 'demeos-possibility-issuance'),
    source TEXT NOT NULL CHECK (source = 'demeos'),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (trusted_customer_identity_id, work_item_id)
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_possibility_issuances_owner_issued_idx
    ON demeos_customer_possibility_issuances
      (trusted_customer_identity_id, issued_at DESC)`,
  `CREATE TABLE IF NOT EXISTS demeos_customer_saved_possibilities (
    saved_possibility_id BIGSERIAL PRIMARY KEY,
    trusted_customer_identity_id TEXT NOT NULL,
    work_item_id TEXT NOT NULL REFERENCES demeos_campaigns(campaign_id),
    possibility_content TEXT NOT NULL,
    business_name TEXT NOT NULL,
    location TEXT,
    relevance_basis TEXT NOT NULL CHECK (relevance_basis = 'explicit-customer-intent-overlap'),
    evidence_type TEXT NOT NULL CHECK (evidence_type = 'customer-saved-possibility'),
    source TEXT NOT NULL CHECK (source = 'authenticated-customer'),
    action TEXT NOT NULL CHECK (action = 'saved'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (trusted_customer_identity_id, work_item_id)
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_saved_possibilities_owner_created_idx
    ON demeos_customer_saved_possibilities
      (trusted_customer_identity_id, created_at DESC, saved_possibility_id DESC)`,
  `CREATE TABLE IF NOT EXISTS demeos_customer_preferences (
    preference_id BIGSERIAL PRIMARY KEY,
    trusted_customer_identity_id TEXT NOT NULL,
    preference_text TEXT NOT NULL,
    evidence_type TEXT NOT NULL CHECK (evidence_type = 'customer-explicit-preference'),
    source TEXT NOT NULL CHECK (source = 'authenticated-customer'),
    confirmation_state TEXT NOT NULL CHECK (confirmation_state = 'confirmed'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_customer_preferences_owner_created_idx
    ON demeos_customer_preferences
      (trusted_customer_identity_id, created_at DESC, preference_id DESC)`
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
