const SCHEMA_STATEMENTS = [
  // Private stock extension of the existing business catalogue; no second catalogue.

  `CREATE TABLE IF NOT EXISTS demeos_businesses (
    business_id TEXT PRIMARY KEY,
    profile JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_business_application_reviews (
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    application_revision TEXT NOT NULL CHECK (application_revision ~ '^[a-f0-9]{64}$'),
    administrator_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('reviewed', 'changes-requested')),
    notes TEXT NOT NULL CHECK (CHAR_LENGTH(notes) <= 2000),
    reviewed_snapshot JSONB NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (business_id, application_revision)
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_business_owners (
    trusted_identity_id TEXT NOT NULL,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (trusted_identity_id, business_id)
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_vendor_inventory (
    business_id TEXT PRIMARY KEY REFERENCES demeos_businesses(business_id),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    entries JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_vendor_stock_history (
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    revision INTEGER NOT NULL,
    trusted_identity_id TEXT NOT NULL,
    changes JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (business_id, revision)
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_vendor_orders (
    order_id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    customer_id TEXT NOT NULL,
    request_key TEXT NOT NULL,
    request_signature TEXT NOT NULL,
    record JSONB NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('reserved','cancelled','expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(customer_id, request_key),
    CHECK (record @> '{"source":"authoritative-catalogue","mode":"live","paymentState":"not-started"}'::jsonb),
    CHECK (record ?& ARRAY['id','businessId','customerId','state','line','remainingReserved','expiresAt']),
    CHECK ((record->>'expiresAt')::timestamptz = expires_at),
    CHECK ((record->>'remainingReserved')::integer >= 0 AND (record->>'remainingReserved')::integer <= (record->'line'->>'quantity')::integer),
    CHECK ((state='reserved' AND (record->>'remainingReserved')::integer > 0) OR (state<>'reserved' AND (record->>'remainingReserved')::integer=0)),
    CHECK (record->>'source' = 'authoritative-catalogue'),
    CHECK (record->>'mode' = 'live'),
    CHECK (record->>'businessId' = business_id),
    CHECK (record->>'customerId' = customer_id),
    CHECK (record->>'id' = order_id),
    CHECK (record->>'state' = state),
    CHECK (record->>'paymentState' = 'not-started')
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_vendor_orders_expiry_idx
    ON demeos_vendor_orders(expires_at, order_id) WHERE state = 'reserved'`,
  `CREATE TABLE IF NOT EXISTS demeos_vendor_order_requests (
    customer_id TEXT NOT NULL,
    request_key TEXT NOT NULL,
    request_signature TEXT NOT NULL,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(customer_id, request_key)
  )`,
  `CREATE TABLE IF NOT EXISTS demeos_vendor_order_events (
    order_id TEXT NOT NULL REFERENCES demeos_vendor_orders(order_id),
    event TEXT NOT NULL CHECK (event IN ('reserved','cancelled','expired')),
    actor_id TEXT NOT NULL,
    inventory_revision INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(order_id, event)
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
  `CREATE INDEX IF NOT EXISTS demeos_campaigns_invalid_publication_diagnostics_idx
    ON demeos_campaigns (updated_at DESC, campaign_id DESC)
    WHERE campaign->>'approvalStatus' = 'Approved'
      AND (COALESCE(campaign->>'campaignType', '') NOT IN ('full', 'social', 'email')
        OR COALESCE(BTRIM(campaign->>'campaignText'), '') = '')`,
  `ALTER TABLE demeos_campaigns
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL`,
  `CREATE TABLE IF NOT EXISTS demeos_recommendation_decisions (
    decision_id BIGSERIAL PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    recommendation_title TEXT NOT NULL,
    suggested_campaign_type TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('used', 'modified', 'rejected')),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE demeos_recommendation_decisions
    ADD COLUMN IF NOT EXISTS recommendation_id TEXT NULL`,
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
  `ALTER TABLE demeos_customer_participations
    ADD COLUMN IF NOT EXISTS evidence_type TEXT NOT NULL DEFAULT 'customer-participation'
      CHECK (evidence_type = 'customer-participation')`,
  `ALTER TABLE demeos_customer_participations
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'customer-interested-action'
      CHECK (source = 'customer-interested-action')`,
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
  `ALTER TABLE demeos_customer_feedback
    ADD COLUMN IF NOT EXISTS evidence_type TEXT NOT NULL DEFAULT 'customer-feedback'
      CHECK (evidence_type = 'customer-feedback')`,
  `ALTER TABLE demeos_customer_feedback
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'customer-feedback-action'
      CHECK (source = 'customer-feedback-action')`,
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
    business_name_snapshot TEXT NOT NULL,
    location_snapshot TEXT,
    evidence_type TEXT NOT NULL CHECK (evidence_type = 'demeos-possibility-issuance'),
    source TEXT NOT NULL CHECK (source = 'demeos'),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (trusted_customer_identity_id, work_item_id)
  )`,
  `ALTER TABLE demeos_customer_possibility_issuances
    ADD COLUMN IF NOT EXISTS business_name_snapshot TEXT`,
  `ALTER TABLE demeos_customer_possibility_issuances
    ADD COLUMN IF NOT EXISTS location_snapshot TEXT`,
  `ALTER TABLE demeos_customer_possibility_issuances
    ADD COLUMN IF NOT EXISTS intention_id BIGINT NULL REFERENCES demeos_customer_intentions(intention_id)`,
  `ALTER TABLE demeos_customer_possibility_issuances
    ADD COLUMN IF NOT EXISTS public_products_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb`,
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
      (trusted_customer_identity_id, created_at DESC, preference_id DESC)`,
  `CREATE TABLE IF NOT EXISTS demeos_business_media_assets (
    asset_id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    asset JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_business_media_assets_business_created_idx
    ON demeos_business_media_assets (business_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS demeos_media_processing_jobs (
    job_id BIGSERIAL PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES demeos_business_media_assets(asset_id),
    business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (asset_id)
  )`,
  `CREATE INDEX IF NOT EXISTS demeos_media_processing_jobs_queue_idx
    ON demeos_media_processing_jobs (status, available_at, job_id)`,
  `CREATE TABLE IF NOT EXISTS demeos_customer_privacy_controls (
    trusted_customer_identity_id TEXT PRIMARY KEY,
    use_preferences_as_guidance BOOLEAN NOT NULL DEFAULT FALSE,
    use_feedback_as_guidance BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`
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
    // All reservation reads/writes must share one connection. Never BEGIN on a pool.
    async transaction(work) {
      await ensureSchema();
      if (typeof client.transaction === 'function') return client.transaction(work);
      if (typeof client.connect !== 'function') throw new Error('Pinned transactions unavailable');
      const connection = await client.connect();
      try {
        await connection.query('BEGIN');
        const result = await work(connection);
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally { connection.release(); }
    },
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
