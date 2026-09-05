CREATE TABLE IF NOT EXISTS demeos_businesses (
  business_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS demeos_campaigns (
  campaign_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES demeos_businesses(business_id),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS demeos_campaigns_business_id_created_at
  ON demeos_campaigns (business_id, created_at DESC);
