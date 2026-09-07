const { getDatabase } = require("./database.js");

const fullCampaignCustomerSections = ["SOCIAL MEDIA POST", "SHORT AD COPY", "CALL TO ACTION"];

function getCustomerFacingContent(campaign) {
  if (!campaign || typeof campaign.campaignText !== "string" || !campaign.campaignText.trim()) return null;
  if (campaign.campaignType !== "full") return campaign.campaignText.trim();

  const headings = ["CAMPAIGN STRATEGY", "SOCIAL MEDIA POST", "EMAIL CAMPAIGN", "SHORT AD COPY", "CALL TO ACTION"];
  const headingPattern = new RegExp(`^[\\t ]*(${headings.join("|")})[\\t ]*\\r?$`, "gm");
  const matches = Array.from(campaign.campaignText.matchAll(headingPattern));
  if (matches.length !== headings.length || !matches.every(function (match, index) { return match[1] === headings[index]; })) {
    return null;
  }

  const sections = matches.map(function (match, index) {
    const contentStart = match.index + match[0].length;
    const contentEnd = index + 1 < matches.length ? matches[index + 1].index : campaign.campaignText.length;
    return { heading: match[1], content: campaign.campaignText.slice(contentStart, contentEnd).trim() };
  });
  if (sections.some(function (section) { return !section.content; })) return null;

  return sections.filter(function (section) { return fullCampaignCustomerSections.includes(section.heading); })
    .map(function (section) { return section.content; }).join("\n\n");
}

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
        `SELECT campaign,
           (SELECT COUNT(*)::integer FROM demeos_customer_participations p
            WHERE p.business_id = demeos_campaigns.business_id
              AND p.campaign_id = demeos_campaigns.campaign_id
              AND p.action = 'Interested') AS customer_interest_count
         FROM demeos_campaigns WHERE business_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [businessId]
      );
      const decisionResult = await database.query(
        `SELECT recommendation_title, suggested_campaign_type, decision, decided_at
         FROM demeos_recommendation_decisions
         WHERE business_id = $1 ORDER BY decided_at DESC LIMIT 100`,
        [businessId]
      );
      return {
        businessProfile: { ...businessResult.rows[0].profile, businessId },
        campaigns: campaignResult.rows.map(function (row) {
          const campaign = { ...row.campaign, businessId };
          if (row.customer_interest_count !== undefined) {
            campaign.customerInterestCount = Number(row.customer_interest_count || 0);
          }
          return campaign;
        }),
        recommendationDecisions: decisionResult.rows.map(function (row) {
          return {
            businessId,
            recommendationTitle: row.recommendation_title,
            suggestedCampaignType: row.suggested_campaign_type,
            decision: row.decision,
            timestamp: row.decided_at instanceof Date ? row.decided_at.toISOString() : row.decided_at
          };
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
    },

    async saveRecommendationDecision(decision) {
      await database.ensureSchema();
      const result = await database.query(
        `INSERT INTO demeos_recommendation_decisions
           (business_id, recommendation_title, suggested_campaign_type, decision, decided_at)
         SELECT $1, $2, $3, $4, $5
         WHERE EXISTS (SELECT 1 FROM demeos_businesses WHERE business_id = $1)
         RETURNING recommendation_title, suggested_campaign_type, decision, decided_at`,
        [decision.businessId, decision.recommendationTitle, decision.suggestedCampaignType,
          decision.decision, decision.timestamp]
      );
      if (!result.rows.length) return null;
      return { ...decision, businessId: decision.businessId };
    },

    async getCustomerWork() {
      await database.ensureSchema();
      const result = await database.query(
        `SELECT c.campaign_id, c.business_id, c.campaign, b.profile
         FROM demeos_campaigns c
         JOIN demeos_businesses b ON b.business_id = c.business_id
         WHERE c.campaign->>'approvalStatus' = 'Approved'
         ORDER BY c.updated_at DESC LIMIT 20`
      );
      return result.rows.map(function (row) {
        const content = getCustomerFacingContent(row.campaign);
        if (!content) return null;
        return {
          workItemId: row.campaign_id,
          businessId: row.business_id,
          businessName: row.profile.name,
          location: row.profile.location,
          content,
          participationAction: "Interested"
        };
      }).filter(Boolean);
    },

    async recordCustomerParticipation(businessId, campaignId, action) {
      await database.ensureSchema();
      const result = await database.query(
        `INSERT INTO demeos_customer_participations (business_id, campaign_id, action)
         SELECT c.business_id, c.campaign_id, $3
         FROM demeos_campaigns c
         WHERE c.business_id = $1 AND c.campaign_id = $2
           AND c.campaign->>'approvalStatus' = 'Approved'
         RETURNING business_id, campaign_id, action, participated_at`,
        [businessId, campaignId, action]
      );
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
