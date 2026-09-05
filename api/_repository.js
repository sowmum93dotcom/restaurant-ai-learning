"use strict";

const { createClient } = require("@vercel/postgres");

function databaseRepository() {
  const client = createClient();
  return {
    async getBusiness(businessId) {
      await client.connect();
      const result = await client.sql`SELECT payload FROM demeos_businesses WHERE business_id = ${businessId}`;
      return result.rows[0] ? result.rows[0].payload : null;
    },
    async saveBusiness(business) {
      await client.connect();
      await client.sql`INSERT INTO demeos_businesses (business_id, payload) VALUES (${business.businessId}, ${JSON.stringify(business)}::jsonb)
        ON CONFLICT (business_id) DO UPDATE SET payload = EXCLUDED.payload`;
      return business;
    },
    async getCampaigns(businessId) {
      await client.connect();
      const result = await client.sql`SELECT payload FROM demeos_campaigns WHERE business_id = ${businessId} ORDER BY created_at DESC`;
      return result.rows.map(function (row) { return row.payload; });
    },
    async saveCampaign(campaign, businessId) {
      await client.connect();
      await client.sql`INSERT INTO demeos_campaigns (campaign_id, business_id, payload) VALUES (${campaign.id}, ${businessId}, ${JSON.stringify(campaign)}::jsonb)
        ON CONFLICT (campaign_id) DO UPDATE SET business_id = EXCLUDED.business_id, payload = EXCLUDED.payload
        WHERE demeos_campaigns.business_id = EXCLUDED.business_id`;
      return campaign;
    }
  };
}

module.exports = databaseRepository();
