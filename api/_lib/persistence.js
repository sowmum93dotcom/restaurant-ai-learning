const { getDatabase } = require("./database.js");
const {
  canPublishToDemeosCustomerExperience,
  getCustomerFacingContent
} = require("./customer-publication-rules.js");

function createPersistenceRepository(database) {
  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  return {
    async getOwnedBusinessIds(trustedIdentityId) {
      if (!isNonEmptyString(trustedIdentityId)) return [];
      await database.ensureSchema();
      const result = await database.query(
        `SELECT business_id FROM demeos_business_owners
         WHERE trusted_identity_id = $1
         ORDER BY business_id`, [trustedIdentityId]);
      return result.rows.map(function (row) { return row.business_id; });
    },

    async getOwnedBusinessProfiles(trustedIdentityId) {
      if (!isNonEmptyString(trustedIdentityId)) return [];
      await database.ensureSchema();
      const result = await database.query(
        `SELECT b.business_id, b.profile FROM demeos_business_owners o
         JOIN demeos_businesses b ON b.business_id = o.business_id
         WHERE o.trusted_identity_id = $1
         ORDER BY b.business_id`, [trustedIdentityId]);
      return result.rows.map(function (row) {
        return { ...row.profile, businessId: row.business_id };
      });
    },

    async isBusinessOwnedByIdentity(trustedIdentityId, businessId) {
      if (!isNonEmptyString(trustedIdentityId) || !isNonEmptyString(businessId)) return false;
      await database.ensureSchema();
      const result = await database.query(
        `SELECT 1 FROM demeos_business_owners
         WHERE trusted_identity_id = $1 AND business_id = $2
         LIMIT 1`, [trustedIdentityId, businessId]);
      return result.rows.length > 0;
    },

    async assignBusinessOwner(trustedIdentityId, businessId) {
      if (!isNonEmptyString(trustedIdentityId) || !isNonEmptyString(businessId)) return null;
      await database.ensureSchema();
      const result = await database.query(
        `INSERT INTO demeos_business_owners (trusted_identity_id, business_id)
         SELECT $1, $2
         WHERE EXISTS (SELECT 1 FROM demeos_businesses WHERE business_id = $2)
         ON CONFLICT (trusted_identity_id, business_id) DO NOTHING
         RETURNING trusted_identity_id, business_id, created_at`, [trustedIdentityId, businessId]);
      if (result.rows.length) {
        const row = result.rows[0];
        return { trustedIdentityId: row.trusted_identity_id, businessId: row.business_id,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
      }
      const stored = await database.query(
        `SELECT trusted_identity_id, business_id, created_at
         FROM demeos_business_owners
         WHERE trusted_identity_id = $1 AND business_id = $2`, [trustedIdentityId, businessId]);
      if (!stored.rows.length) return null;
      const row = stored.rows[0];
      return { trustedIdentityId: row.trusted_identity_id, businessId: row.business_id,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
    },

    async createBusinessForOwner(trustedIdentityId, profile) {
      if (!isNonEmptyString(trustedIdentityId) || !profile || !isNonEmptyString(profile.businessId)) return null;
      await database.ensureSchema();
      const result = await database.query(
        `WITH inserted_business AS (
           INSERT INTO demeos_businesses (business_id, profile)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (business_id) DO NOTHING
           RETURNING business_id
         ), inserted_owner AS (
           INSERT INTO demeos_business_owners (trusted_identity_id, business_id)
           SELECT $3, business_id FROM inserted_business
           ON CONFLICT (trusted_identity_id, business_id) DO NOTHING
           RETURNING trusted_identity_id, business_id, created_at
         )
         SELECT trusted_identity_id, business_id, created_at FROM inserted_owner`,
        [profile.businessId, JSON.stringify(profile), trustedIdentityId]
      );
      if (!result.rows.length) return null;
      const row = result.rows[0];
      return { trustedIdentityId: row.trusted_identity_id, businessId: row.business_id,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
    },

    async getKnownBusiness(businessId) {
      await database.ensureSchema();
      const businessResult = await database.query("SELECT profile FROM demeos_businesses WHERE business_id = $1", [businessId]);
      if (!businessResult.rows.length) return null;
      const campaignResult = await database.query(
        `SELECT campaign_id, campaign,
           (SELECT COUNT(*)::integer FROM demeos_customer_participations p
            WHERE p.business_id = demeos_campaigns.business_id AND p.campaign_id = demeos_campaigns.campaign_id
              AND p.action = 'Interested') AS customer_interest_count,
           (SELECT MAX(p.participated_at) FROM demeos_customer_participations p
            WHERE p.business_id = demeos_campaigns.business_id AND p.campaign_id = demeos_campaigns.campaign_id
              AND p.action = 'Interested') AS latest_participation_at
         FROM demeos_campaigns WHERE business_id = $1 ORDER BY created_at DESC LIMIT 20`, [businessId]);
      const decisionResult = await database.query(
        `SELECT recommendation_title, suggested_campaign_type, decision, decided_at
         FROM demeos_recommendation_decisions WHERE business_id = $1 ORDER BY decided_at DESC LIMIT 100`, [businessId]);
      const campaigns = campaignResult.rows.map(function (row) {
        const campaign = { ...row.campaign, businessId };
        if (row.customer_interest_count !== undefined) campaign.customerInterestCount = Number(row.customer_interest_count || 0);
        return campaign;
      });
      const customerParticipationResults = campaignResult.rows.map(function (row) {
        const campaign = row.campaign;
        if (!canPublishToDemeosCustomerExperience(campaign)) return null;
        const latest = row.latest_participation_at;
        return { workItemId: row.campaign_id, businessId,
          name: (typeof campaign.promoText === "string" && campaign.promoText.trim()) || campaign.campaignTypeLabel || campaign.campaignType || "Approved work",
          customerInterestCount: Number(row.customer_interest_count || 0), latestParticipationAt: latest instanceof Date ? latest.toISOString() : latest || null };
      }).filter(Boolean);
      return { businessProfile: { ...businessResult.rows[0].profile, businessId }, campaigns, customerParticipationResults,
        recommendationDecisions: decisionResult.rows.map(function (row) {
          return { businessId, recommendationTitle: row.recommendation_title, suggestedCampaignType: row.suggested_campaign_type,
            decision: row.decision, timestamp: row.decided_at instanceof Date ? row.decided_at.toISOString() : row.decided_at };
        }) };
    },

    async saveBusiness(profile) {
      await database.ensureSchema();
      await database.query(
        `INSERT INTO demeos_businesses (business_id, profile)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (business_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = NOW()`,
        [profile.businessId, JSON.stringify(profile)]);
    },

    async saveCampaign(campaign) {
      await database.ensureSchema();
      const result = await database.query(
        `INSERT INTO demeos_campaigns (campaign_id, business_id, campaign)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (campaign_id) DO UPDATE SET campaign = EXCLUDED.campaign, updated_at = NOW()
         WHERE demeos_campaigns.business_id = EXCLUDED.business_id
         RETURNING campaign`,
        [campaign.id, campaign.businessId, JSON.stringify(campaign)]);
      return result.rows.length
        ? { ...result.rows[0].campaign, id: campaign.id, businessId: campaign.businessId }
        : null;
    },

    async approveCampaign(businessId, campaignId) {
      if (!isNonEmptyString(businessId) || !isNonEmptyString(campaignId)) return null;
      await database.ensureSchema();
      const result = await database.query(
        `UPDATE demeos_campaigns
         SET campaign = jsonb_set(campaign, '{approvalStatus}', '"Approved"'::jsonb), updated_at = NOW()
         WHERE campaign_id = $1 AND business_id = $2
           AND campaign->>'approvalStatus' = 'Unapproved'
         RETURNING campaign`,
        [campaignId, businessId]);
      return result.rows.length
        ? { ...result.rows[0].campaign, id: campaignId, businessId }
        : null;
    },

    async saveCampaignOutcome(businessId, campaignId, outcome) {
      await database.ensureSchema();
      const result = await database.query(
        `UPDATE demeos_campaigns SET campaign = jsonb_set(campaign, '{outcome}', $3::jsonb, true), updated_at = NOW()
         WHERE campaign_id = $1 AND business_id = $2 AND campaign->>'approvalStatus' = 'Approved' RETURNING campaign`,
        [campaignId, businessId, JSON.stringify(outcome)]);
      return result.rows.length ? { ...result.rows[0].campaign, id: campaignId, businessId } : null;
    },

    async saveRecommendationDecision(decision) {
      await database.ensureSchema();
      const result = await database.query(
        `INSERT INTO demeos_recommendation_decisions
           (business_id, recommendation_title, suggested_campaign_type, decision, decided_at)
         SELECT $1, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM demeos_businesses WHERE business_id = $1)
         RETURNING recommendation_title, suggested_campaign_type, decision, decided_at`,
        [decision.businessId, decision.recommendationTitle, decision.suggestedCampaignType, decision.decision, decision.timestamp]);
      if (!result.rows.length) return null;
      return { ...decision, businessId: decision.businessId };
    },

    async getCustomerWork() {
      await database.ensureSchema();
      const result = await database.query(
        `SELECT c.campaign_id, c.business_id, c.campaign, b.profile FROM demeos_campaigns c
         JOIN demeos_businesses b ON b.business_id = c.business_id
         WHERE c.campaign->>'approvalStatus' = 'Approved' ORDER BY c.updated_at DESC`);
      return result.rows.map(function (row) {
        if (!canPublishToDemeosCustomerExperience(row.campaign)) return null;
        return { workItemId: row.campaign_id, businessName: row.profile.name,
          location: row.profile.location, content: getCustomerFacingContent(row.campaign), participationAction: "Interested" };
      }).filter(Boolean).slice(0, 20);
    },

    async recordCustomerParticipation(campaignId, action) {
      await database.ensureSchema();
      const campaignResult = await database.query(
        `SELECT business_id, campaign FROM demeos_campaigns WHERE campaign_id = $1`, [campaignId]);
      if (!campaignResult.rows.length || !canPublishToDemeosCustomerExperience(campaignResult.rows[0].campaign)) return null;
      const result = await database.query(
        `INSERT INTO demeos_customer_participations (business_id, campaign_id, action)
         SELECT c.business_id, c.campaign_id, $2 FROM demeos_campaigns c
         WHERE c.campaign_id = $1 AND c.campaign->>'approvalStatus' = 'Approved'
           AND c.campaign = $3::jsonb RETURNING business_id, campaign_id, action, participated_at`,
        [campaignId, action, JSON.stringify(campaignResult.rows[0].campaign)]);
      return result.rows.length ? result.rows[0] : null;
    }
  };
}

let defaultRepository;
function getRepository() {
  if (!defaultRepository) defaultRepository = createPersistenceRepository(getDatabase());
  return defaultRepository;
}

module.exports = { createPersistenceRepository, getRepository, getCustomerFacingContent };
