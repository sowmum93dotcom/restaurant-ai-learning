const { getDatabase } = require("./database.js");

function createPersistenceRepository(database) {
  return {
    async getKnownBusiness(businessId) {
      await database.ensureSchema();
      const businessResult = await database.query(
        "SELECT profile FROM demeos_businesses WHERE business_id = $1",
        [businessId]
      );
      if (!businessResult.rows.length) return null;

      const campaignResult = await database.query(
        "SELECT campaign FROM demeos_campaigns WHERE business_id = $1 ORDER BY created_at DESC LIMIT 20",
        [businessId]
      );
      return {
        businessProfile: { ...businessResult.rows[0].profile, businessId },
        campaigns: campaignResult.rows.map(function (row) {
          return { ...row.campaign, businessId };
        })
      };
    },

    async saveBusiness(profile) {
      await database.ensureSchema();
      await database.query(
        `INSERT INTO demeos_businesses (business_id, profile)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (business_id) DO UPDATE
         SET profile = EXCLUDED.profile, updated_at = NOW()`,
        [profile.businessId, JSON.stringify(profile)]
      );
    },

    async saveCampaign(campaign) {
      await database.ensureSchema();
      await database.query(
        `INSERT INTO demeos_campaigns (campaign_id, business_id, campaign)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (campaign_id) DO UPDATE
         SET campaign = EXCLUDED.campaign, updated_at = NOW()
         WHERE demeos_campaigns.business_id = EXCLUDED.business_id`,
        [campaign.id, campaign.businessId, JSON.stringify(campaign)]
      );
    },

    async saveCampaignOutcome(businessId, campaignId, outcome) {
      await database.ensureSchema();
      const result = await database.query(
        `UPDATE demeos_campaigns
         SET campaign = jsonb_set(campaign, '{outcome}', $3::jsonb, true), updated_at = NOW()
         WHERE campaign_id = $1
           AND business_id = $2
           AND campaign->>'approvalStatus' = 'Approved'
         RETURNING campaign`,
        [campaignId, businessId, JSON.stringify(outcome)]
      );
      return result.rows.length ? { ...result.rows[0].campaign, id: campaignId, businessId } : null;
    }
  };
}

let defaultRepository;
function getRepository() {
  if (!defaultRepository) defaultRepository = createPersistenceRepository(getDatabase());
  return defaultRepository;
}

module.exports = { createPersistenceRepository, getRepository };
