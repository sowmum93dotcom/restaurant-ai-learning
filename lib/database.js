let client;
let schemaPromise;

function database() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Database connection is not configured");
  if (!client) {
    const postgres = require("postgres");
    client = postgres(connectionString, { ssl: "require", max: 1 });
  }
  return client;
}

async function ensureSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = (async function () {
      await sql`CREATE TABLE IF NOT EXISTS demeos_business_profiles (
        business_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        location TEXT NOT NULL,
        brand_voice TEXT NOT NULL,
        target_customer TEXT NOT NULL,
        goal TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS demeos_campaigns (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES demeos_business_profiles(business_id),
        campaign_text TEXT NOT NULL,
        campaign_type TEXT NOT NULL,
        campaign_type_label TEXT NOT NULL,
        promo_text TEXT NOT NULL,
        business_name TEXT NOT NULL,
        approval_status TEXT NOT NULL CHECK (approval_status IN ('Approved', 'Unapproved')),
        original_marketing_work_id TEXT NOT NULL,
        revision_number INTEGER NOT NULL CHECK (revision_number >= 0),
        created_at TIMESTAMPTZ NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS demeos_campaigns_business_created_idx
        ON demeos_campaigns (business_id, created_at DESC)`;
    })().catch(function (error) { schemaPromise = null; throw error; });
  }
  await schemaPromise;
}

function mapProfile(row) {
  return { businessId: row.business_id, name: row.name, type: row.type, location: row.location,
    brandVoice: row.brand_voice, targetCustomer: row.target_customer, goal: row.goal,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() };
}

function mapCampaign(row) {
  return { id: row.id, businessId: row.business_id, campaignText: row.campaign_text,
    campaignType: row.campaign_type, campaignTypeLabel: row.campaign_type_label,
    promoText: row.promo_text, businessName: row.business_name, approvalStatus: row.approval_status,
    originalMarketingWorkId: row.original_marketing_work_id, revisionNumber: row.revision_number,
    createdAt: new Date(row.created_at).toISOString() };
}

function createRepository(sql = database()) {
  return {
    async listProfiles() {
      await ensureSchema(sql);
      return (await sql`SELECT * FROM demeos_business_profiles ORDER BY created_at`).map(mapProfile);
    },
    async upsertProfile(profile) {
      await ensureSchema(sql);
      const rows = await sql`INSERT INTO demeos_business_profiles
        (business_id, name, type, location, brand_voice, target_customer, goal, created_at, updated_at)
        VALUES (${profile.businessId}, ${profile.name}, ${profile.type}, ${profile.location},
          ${profile.brandVoice}, ${profile.targetCustomer}, ${profile.goal},
          ${profile.createdAt || new Date().toISOString()}, NOW())
        ON CONFLICT (business_id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type,
          location = EXCLUDED.location, brand_voice = EXCLUDED.brand_voice,
          target_customer = EXCLUDED.target_customer, goal = EXCLUDED.goal, updated_at = NOW()
        RETURNING *`;
      return mapProfile(rows[0]);
    },
    async listCampaigns(businessId) {
      await ensureSchema(sql);
      return (await sql`SELECT * FROM demeos_campaigns WHERE business_id = ${businessId}
        ORDER BY created_at DESC`).map(mapCampaign);
    },
    async upsertCampaign(campaign) {
      await ensureSchema(sql);
      const rows = await sql`INSERT INTO demeos_campaigns
        (id, business_id, campaign_text, campaign_type, campaign_type_label, promo_text,
          business_name, approval_status, original_marketing_work_id, revision_number, created_at)
        VALUES (${campaign.id}, ${campaign.businessId}, ${campaign.campaignText},
          ${campaign.campaignType}, ${campaign.campaignTypeLabel}, ${campaign.promoText || ""},
          ${campaign.businessName}, ${campaign.approvalStatus}, ${campaign.originalMarketingWorkId},
          ${campaign.revisionNumber}, ${campaign.createdAt})
        ON CONFLICT (id) DO UPDATE SET campaign_text = EXCLUDED.campaign_text,
          campaign_type = EXCLUDED.campaign_type, campaign_type_label = EXCLUDED.campaign_type_label,
          promo_text = EXCLUDED.promo_text, business_name = EXCLUDED.business_name,
          approval_status = EXCLUDED.approval_status
        WHERE demeos_campaigns.business_id = EXCLUDED.business_id RETURNING *`;
      if (!rows[0]) throw new Error("Campaign belongs to a different business");
      return mapCampaign(rows[0]);
    },
    async updateApproval(id, businessId, approvalStatus) {
      await ensureSchema(sql);
      const rows = await sql`UPDATE demeos_campaigns SET approval_status = ${approvalStatus}
        WHERE id = ${id} AND business_id = ${businessId} RETURNING *`;
      return rows[0] ? mapCampaign(rows[0]) : null;
    }
  };
}

module.exports = { createRepository, mapCampaign, mapProfile };
