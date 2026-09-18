const { getDatabase } = require("./database.js");
const {
  canPublishToDemeosCustomerExperience,
  getCustomerFacingContent
} = require("./customer-publication-rules.js");
const { toPublicCustomerWorkItem } = require("./customer-public-work-contract.js");

function createPersistenceRepository(database) {
  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  return {
    async getCustomerPrivacyControls(trustedCustomerIdentityId) {
      const safeDefaults = { usePreferencesAsGuidance: false, useFeedbackAsGuidance: false };
      if (!isNonEmptyString(trustedCustomerIdentityId)) return safeDefaults;
      await database.ensureSchema();
      const result = await database.query(
        `SELECT use_preferences_as_guidance, use_feedback_as_guidance
         FROM demeos_customer_privacy_controls WHERE trusted_customer_identity_id = $1`,
        [trustedCustomerIdentityId]);
      if (!result.rows.length) return safeDefaults;
      return { usePreferencesAsGuidance: result.rows[0].use_preferences_as_guidance === true,
        useFeedbackAsGuidance: result.rows[0].use_feedback_as_guidance === true };
    },

    async saveCustomerPrivacyControls(trustedCustomerIdentityId, controls) {
      if (!isNonEmptyString(trustedCustomerIdentityId) || !controls) return null;
      await database.ensureSchema();
      const result = await database.query(
        `INSERT INTO demeos_customer_privacy_controls
           (trusted_customer_identity_id, use_preferences_as_guidance, use_feedback_as_guidance)
         VALUES ($1, $2, $3)
         ON CONFLICT (trusted_customer_identity_id) DO UPDATE SET
           use_preferences_as_guidance = EXCLUDED.use_preferences_as_guidance,
           use_feedback_as_guidance = EXCLUDED.use_feedback_as_guidance,
           updated_at = NOW()
         RETURNING use_preferences_as_guidance, use_feedback_as_guidance`,
        [trustedCustomerIdentityId, controls.usePreferencesAsGuidance, controls.useFeedbackAsGuidance]);
      const row = result.rows[0];
      return { usePreferencesAsGuidance: row.use_preferences_as_guidance === true,
        useFeedbackAsGuidance: row.use_feedback_as_guidance === true };
    },

    async saveCustomerIntention(trustedCustomerIdentityId, intention) {
      if (!isNonEmptyString(trustedCustomerIdentityId)) return null;
      await database.ensureSchema();
      // The transaction-scoped identity lock and short retry window make a double
      // click/retried request idempotent without merging the same genuine intention
      // when a customer chooses to save it again later.
      const result = await database.query(
        `WITH identity_lock AS (
           SELECT pg_advisory_xact_lock(hashtext($1))
         ), inserted AS (
           INSERT INTO demeos_customer_intentions
             (trusted_customer_identity_id, intention_category, customer_text,
              confirmed_understanding, evidence_type, source, confirmation_state)
           SELECT $1, $2, $3, $4, 'customer-confirmed-intention', 'authenticated-customer', 'confirmed'
           FROM identity_lock
           WHERE NOT EXISTS (
             SELECT 1 FROM demeos_customer_intentions
             WHERE trusted_customer_identity_id = $1 AND intention_category = $2
               AND customer_text IS NOT DISTINCT FROM $3 AND confirmed_understanding = $4
               AND created_at > NOW() - INTERVAL '30 seconds'
           )
           RETURNING intention_id, intention_category, customer_text, confirmed_understanding, created_at
         )
         SELECT * FROM inserted
         UNION ALL
         SELECT intention_id, intention_category, customer_text, confirmed_understanding, created_at
         FROM demeos_customer_intentions
         WHERE trusted_customer_identity_id = $1 AND intention_category = $2
           AND customer_text IS NOT DISTINCT FROM $3 AND confirmed_understanding = $4
           AND created_at > NOW() - INTERVAL '30 seconds'
         ORDER BY created_at DESC LIMIT 1`,
        [trustedCustomerIdentityId, intention.intention, intention.customerText || null, intention.understanding]);
      if (!result.rows.length) return null;
      const row = result.rows[0];
      return { intentionId: String(row.intention_id), intention: row.intention_category, customerText: row.customer_text || undefined,
        understanding: row.confirmed_understanding,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
    },

    async getCustomerIntentions(trustedCustomerIdentityId, limit = 50) {
      if (!isNonEmptyString(trustedCustomerIdentityId)) return [];
      await database.ensureSchema();
      const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 50));
      const result = await database.query(
        `SELECT intention_id, intention_category, customer_text, confirmed_understanding, created_at
         FROM demeos_customer_intentions WHERE trusted_customer_identity_id = $1
         ORDER BY created_at DESC, intention_id DESC LIMIT $2`, [trustedCustomerIdentityId, safeLimit]);
      return result.rows.map(function (row) {
        return { intentionId: String(row.intention_id), intention: row.intention_category, customerText: row.customer_text || undefined,
          understanding: row.confirmed_understanding,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
      });
    },

    async removeCustomerIntention(trustedCustomerIdentityId, intentionId) {
      if (!isNonEmptyString(trustedCustomerIdentityId) || !isNonEmptyString(intentionId)) return false;
      await database.ensureSchema();
      const result = await database.query(
        `DELETE FROM demeos_customer_intentions
         WHERE trusted_customer_identity_id = $1 AND intention_id = $2
         RETURNING intention_id`, [trustedCustomerIdentityId, intentionId]);
      return result.rows.length > 0;
    },

    async saveCustomerPreference(trustedCustomerIdentityId, preference) {
      if (!isNonEmptyString(trustedCustomerIdentityId) || !preference || !isNonEmptyString(preference.preference)) return null;
      await database.ensureSchema();
      const result = await database.query(
        `WITH identity_lock AS (
           SELECT pg_advisory_xact_lock(hashtext($1 || ':preference'))
         ), inserted AS (
         INSERT INTO demeos_customer_preferences
           (trusted_customer_identity_id, preference_text, evidence_type, source, confirmation_state)
         SELECT $1, $2, 'customer-explicit-preference', 'authenticated-customer', 'confirmed'
         FROM identity_lock
         WHERE NOT EXISTS (SELECT 1 FROM demeos_customer_preferences
           WHERE trusted_customer_identity_id = $1 AND preference_text = $2
             AND created_at > NOW() - INTERVAL '30 seconds')
         RETURNING preference_id, preference_text, created_at
         ) SELECT * FROM inserted UNION ALL
         SELECT preference_id, preference_text, created_at FROM demeos_customer_preferences
         WHERE trusted_customer_identity_id = $1 AND preference_text = $2
           AND created_at > NOW() - INTERVAL '30 seconds'
         ORDER BY created_at DESC LIMIT 1`,
        [trustedCustomerIdentityId, preference.preference]);
      return result.rows.length ? toCustomerPreference(result.rows[0]) : null;
    },

    async getCustomerPreferences(trustedCustomerIdentityId, limit = 50) {
      if (!isNonEmptyString(trustedCustomerIdentityId)) return [];
      await database.ensureSchema();
      const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 50));
      const result = await database.query(
        `SELECT preference_id, preference_text, created_at
         FROM demeos_customer_preferences
         WHERE trusted_customer_identity_id = $1
         ORDER BY created_at DESC, preference_id DESC LIMIT $2`,
        [trustedCustomerIdentityId, safeLimit]);
      return result.rows.map(toCustomerPreference);
    },

    async removeCustomerPreference(trustedCustomerIdentityId, preferenceId) {
      if (!isNonEmptyString(trustedCustomerIdentityId) || !isNonEmptyString(preferenceId)) return false;
      await database.ensureSchema();
      const result = await database.query(
        `DELETE FROM demeos_customer_preferences
         WHERE trusted_customer_identity_id = $1 AND preference_id = $2
         RETURNING preference_id`, [trustedCustomerIdentityId, preferenceId]);
      return result.rows.length > 0;
    },

    async saveCustomerPossibility(trustedCustomerIdentityId, workItemId) {
      if (!isNonEmptyString(trustedCustomerIdentityId) || !isNonEmptyString(workItemId)) return null;
      await database.ensureSchema();
      // Resolve and re-check the campaign on the server. Issuance is scoped to the
      // trusted identity and exact campaign snapshot, so a browser reference alone
      // cannot establish that DEMEOS showed this possibility to this customer.
      const authoritative = await database.query(
        `SELECT c.campaign_id, c.campaign, b.profile
         FROM demeos_campaigns c JOIN demeos_businesses b ON b.business_id = c.business_id
         JOIN demeos_customer_possibility_issuances i ON i.work_item_id = c.campaign_id
           AND i.trusted_customer_identity_id = $2 AND i.campaign_snapshot = c.campaign
         WHERE c.campaign_id = $1`, [workItemId, trustedCustomerIdentityId]);
      if (!authoritative.rows.length) return null;
      const row = authoritative.rows[0];
      if (!canPublishToDemeosCustomerExperience(row.campaign)) return null;
      const publicItem = toPublicCustomerWorkItem({ workItemId: row.campaign_id,
        businessName: row.profile && row.profile.name, location: row.profile && row.profile.location,
        content: getCustomerFacingContent(row.campaign), participationAction: "Interested" });
      if (!publicItem) return null;
      const result = await database.query(
        `INSERT INTO demeos_customer_saved_possibilities
           (trusted_customer_identity_id, work_item_id, possibility_content, business_name, location,
            relevance_basis, evidence_type, source, action)
         SELECT $1, c.campaign_id, $3, $4, $5, 'explicit-customer-intent-overlap',
                'customer-saved-possibility', 'authenticated-customer', 'saved'
         FROM demeos_campaigns c
         WHERE c.campaign_id = $2 AND c.campaign = $6::jsonb
           AND c.campaign->>'approvalStatus' = 'Approved'
           AND EXISTS (
             SELECT 1 FROM demeos_customer_possibility_issuances i
             WHERE i.trusted_customer_identity_id = $1 AND i.work_item_id = c.campaign_id
               AND i.campaign_snapshot = c.campaign
           )
         ON CONFLICT (trusted_customer_identity_id, work_item_id) DO UPDATE
           SET trusted_customer_identity_id = EXCLUDED.trusted_customer_identity_id
         RETURNING saved_possibility_id, possibility_content, business_name, location, relevance_basis, created_at`,
        [trustedCustomerIdentityId, workItemId, publicItem.content, publicItem.businessName,
          publicItem.location || null, JSON.stringify(row.campaign)]);
      if (!result.rows.length) return null;
      return toSavedPossibility(result.rows[0]);
    },

    async recordCustomerPossibilityIssuance(trustedCustomerIdentityId, possibilities, understanding = null, intentionId = null) {
      if (!isNonEmptyString(trustedCustomerIdentityId) || !Array.isArray(possibilities) || !possibilities.length) return [];
      await database.ensureSchema();
      const issuedWorkItemIds = [];
      for (const possibility of possibilities) {
        if (!possibility || !isNonEmptyString(possibility.workItemId)) continue;
        const authoritative = await database.query(
          `SELECT c.campaign_id, c.campaign, b.profile
           FROM demeos_campaigns c JOIN demeos_businesses b ON b.business_id = c.business_id
           WHERE c.campaign_id = $1`, [possibility.workItemId]);
        if (!authoritative.rows.length || !canPublishToDemeosCustomerExperience(authoritative.rows[0].campaign)) continue;
        const row = authoritative.rows[0];
        const publicItem = toPublicCustomerWorkItem({ workItemId: row.campaign_id,
          businessName: row.profile && row.profile.name, location: row.profile && row.profile.location,
          content: getCustomerFacingContent(row.campaign), participationAction: "Interested" });
        if (!publicItem || publicItem.content !== possibility.content ||
            publicItem.businessName !== possibility.businessName || publicItem.location !== possibility.location) continue;
        const linkedIntention = understanding && isNonEmptyString(understanding.understanding) && isNonEmptyString(intentionId);
        const intentionExpression = linkedIntention ? `(SELECT intention_id FROM demeos_customer_intentions
              WHERE trusted_customer_identity_id = $1
                AND intention_id = $4
                AND intention_category = $5
                AND customer_text IS NOT DISTINCT FROM $6
                AND confirmed_understanding = $7)` : "NULL";
        const result = await database.query(
          `INSERT INTO demeos_customer_possibility_issuances
             (trusted_customer_identity_id, work_item_id, campaign_snapshot, evidence_type, source, intention_id)
           SELECT $1, c.campaign_id, c.campaign, 'demeos-possibility-issuance', 'demeos',
             ${intentionExpression}
           FROM demeos_campaigns c JOIN demeos_businesses b ON b.business_id = c.business_id
           WHERE c.campaign_id = $2 AND c.campaign = $3::jsonb
             AND c.campaign->>'approvalStatus' = 'Approved'
             AND c.campaign->>'campaignType' IN ('full', 'social', 'email')
             AND COALESCE(BTRIM(c.campaign->>'campaignText'), '') <> ''
           ON CONFLICT (trusted_customer_identity_id, work_item_id) DO NOTHING
           RETURNING work_item_id`,
          linkedIntention ? [trustedCustomerIdentityId, possibility.workItemId, JSON.stringify(row.campaign),
            intentionId, understanding.intention || "", understanding.customerText || null, understanding.understanding]
            : [trustedCustomerIdentityId, possibility.workItemId, JSON.stringify(row.campaign)]);
        // A retry may find the already-issued row. It is still the authoritative
        // issuance, but its original snapshot and timestamp must not be rewritten.
        issuedWorkItemIds.push(result.rows.length ? result.rows[0].work_item_id : possibility.workItemId);
      }
      return issuedWorkItemIds;
    },

    async getCustomerIssuedPossibilities(trustedCustomerIdentityId, limit = 50) {
      if (!isNonEmptyString(trustedCustomerIdentityId)) return [];
      await database.ensureSchema();
      const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 50));
      const result = await database.query(
        `SELECT i.work_item_id, i.campaign_snapshot, i.business_name_snapshot,
                i.location_snapshot, i.issued_at, i.intention_id,
                f.response, f.comment, f.created_at AS feedback_at
         FROM demeos_customer_possibility_issuances i
         LEFT JOIN LATERAL (
           SELECT response, comment, created_at FROM demeos_customer_feedback
           WHERE trusted_customer_identity_id = i.trusted_customer_identity_id
             AND campaign_id = i.work_item_id AND feedback_type = 'possibility-relevance'
           ORDER BY created_at DESC, feedback_id DESC LIMIT 1
         ) f ON TRUE
         WHERE i.trusted_customer_identity_id = $1 AND i.delivery_confirmed = TRUE
         ORDER BY i.issued_at DESC, i.work_item_id DESC LIMIT $2`,
        [trustedCustomerIdentityId, safeLimit]);
      return result.rows.map(function (row) {
        const item = { workItemId: row.work_item_id, content: getCustomerFacingContent(row.campaign_snapshot),
          businessName: row.business_name_snapshot, issuedAt: row.issued_at instanceof Date ? row.issued_at.toISOString() : row.issued_at };
        if (row.location_snapshot) item.location = row.location_snapshot;
        if (row.intention_id !== null && row.intention_id !== undefined) item.intentionId = String(row.intention_id);
        if (row.response) item.feedback = { response: row.response,
          createdAt: row.feedback_at instanceof Date ? row.feedback_at.toISOString() : row.feedback_at };
        if (item.feedback && isNonEmptyString(row.comment)) item.feedback.comment = row.comment;
        return item;
      }).filter(function (item) { return isNonEmptyString(item.content); });
    },

    async getCustomerSavedPossibilities(trustedCustomerIdentityId, limit = 50) {
      if (!isNonEmptyString(trustedCustomerIdentityId)) return [];
      await database.ensureSchema();
      const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 50));
      const result = await database.query(
        `SELECT s.saved_possibility_id, s.possibility_content, s.business_name, s.location, s.relevance_basis, s.created_at,
                i.campaign_snapshot, i.issued_at
         FROM demeos_customer_saved_possibilities s
         LEFT JOIN demeos_customer_possibility_issuances i
           ON i.trusted_customer_identity_id = s.trusted_customer_identity_id
          AND i.work_item_id = s.work_item_id
         WHERE s.trusted_customer_identity_id = $1
         ORDER BY s.created_at DESC, s.saved_possibility_id DESC LIMIT $2`,
        [trustedCustomerIdentityId, safeLimit]);
      return result.rows.map(function (row) {
        const item = toSavedPossibility(row);
        const snapshot = row.campaign_snapshot && typeof row.campaign_snapshot === "object" ? row.campaign_snapshot : {};
        const products = Array.isArray(snapshot.products) ? snapshot.products : [];
        if (products.length) item.products = products.map(function (product) {
          return {
            productId: product.productId, name: product.name, description: product.description,
            price: product.price, imageUrl: product.imageUrl, availability: product.availability
          };
        }).filter(function (product) { return isNonEmptyString(product.productId) && isNonEmptyString(product.name); });
        if (row.issued_at) item.issuedAt = row.issued_at instanceof Date ? row.issued_at.toISOString() : row.issued_at;
        return item;
      });
    },
    async removeCustomerSavedPossibility(trustedCustomerIdentityId, savedPossibilityId) {
      if (!isNonEmptyString(trustedCustomerIdentityId) || !isNonEmptyString(savedPossibilityId)) return false;
      await database.ensureSchema();
      // Only the customer's saved relationship row is removed. The referenced
      // campaign and all participation and feedback evidence remain untouched.
      const result = await database.query(
        `DELETE FROM demeos_customer_saved_possibilities
         WHERE trusted_customer_identity_id = $1 AND saved_possibility_id = $2
         RETURNING saved_possibility_id`, [trustedCustomerIdentityId, savedPossibilityId]);
      return result.rows.length > 0;
    },
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
        `SELECT campaign_id, campaign, created_at, approved_at,
           (SELECT COUNT(*)::integer FROM demeos_customer_participations p
            WHERE p.business_id = demeos_campaigns.business_id AND p.campaign_id = demeos_campaigns.campaign_id
              AND p.action = 'Interested') AS customer_interest_count,
           (SELECT MAX(p.participated_at) FROM demeos_customer_participations p
            WHERE p.business_id = demeos_campaigns.business_id AND p.campaign_id = demeos_campaigns.campaign_id
              AND p.action = 'Interested') AS latest_participation_at,
           (SELECT MAX(f.created_at) FROM demeos_customer_feedback f
            WHERE f.business_id = demeos_campaigns.business_id AND f.campaign_id = demeos_campaigns.campaign_id
              AND f.feedback_type = 'possibility-relevance') AS latest_feedback_at,
           (SELECT COUNT(*)::integer FROM demeos_customer_feedback f
            WHERE f.business_id = demeos_campaigns.business_id AND f.campaign_id = demeos_campaigns.campaign_id
              AND f.feedback_type = 'possibility-relevance' AND f.response = 'Relevant') AS feedback_relevant_count,
           (SELECT COUNT(*)::integer FROM demeos_customer_feedback f
            WHERE f.business_id = demeos_campaigns.business_id AND f.campaign_id = demeos_campaigns.campaign_id
              AND f.feedback_type = 'possibility-relevance' AND f.response = 'Not quite') AS feedback_not_quite_count,
           (SELECT COUNT(*)::integer FROM demeos_customer_feedback f
            WHERE f.business_id = demeos_campaigns.business_id AND f.campaign_id = demeos_campaigns.campaign_id
              AND f.feedback_type = 'possibility-relevance' AND f.response = 'Something different') AS feedback_something_different_count
         FROM demeos_campaigns WHERE business_id = $1 ORDER BY created_at DESC LIMIT 20`, [businessId]);
      const decisionResult = await database.query(
        `SELECT decision_id, recommendation_id, recommendation_title, suggested_campaign_type, decision, decided_at
         FROM demeos_recommendation_decisions WHERE business_id = $1 ORDER BY decided_at DESC LIMIT 100`, [businessId]);
      const campaigns = campaignResult.rows.map(function (row) {
        const campaign = { ...row.campaign, businessId,
          ...(row.created_at ? { recordedAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at } : {}),
          ...(row.approved_at ? { approvedAt: row.approved_at instanceof Date ? row.approved_at.toISOString() : row.approved_at } : {}) };
        if (row.customer_interest_count !== undefined) campaign.customerInterestCount = Number(row.customer_interest_count || 0);
        return campaign;
      });
      const customerParticipationResults = campaignResult.rows.map(function (row) {
        const campaign = row.campaign;
        if (!canPublishToDemeosCustomerExperience(campaign)) return null;
        const latest = row.latest_participation_at;
        return { workItemId: row.campaign_id, businessId,
          name: (typeof campaign.promoText === "string" && campaign.promoText.trim()) || campaign.campaignTypeLabel || campaign.campaignType || "Approved work",
          customerInterestCount: Number(row.customer_interest_count || 0),
          evidenceType: "customer-participation", source: "customer-interested-action",
          latestParticipationAt: latest instanceof Date ? latest.toISOString() : latest || null };
      }).filter(Boolean);
      const customerFeedbackResults = campaignResult.rows.map(function (row) {
        const latest = row.latest_feedback_at;
        return { workItemId: row.campaign_id, businessId,
          evidenceType: "customer-feedback", source: "customer-feedback-action",
          relevantCount: Number(row.feedback_relevant_count || 0),
          notQuiteCount: Number(row.feedback_not_quite_count || 0),
          somethingDifferentCount: Number(row.feedback_something_different_count || 0),
          latestFeedbackAt: latest instanceof Date ? latest.toISOString() : latest || null };
      });
      return { businessProfile: { ...businessResult.rows[0].profile, businessId }, campaigns, customerParticipationResults,
        customerFeedbackResults,
        recommendationDecisions: decisionResult.rows.map(function (row) {
          return { decisionId: String(row.decision_id), ...(row.recommendation_id ? { recommendationId: row.recommendation_id } : {}), businessId, recommendationTitle: row.recommendation_title, suggestedCampaignType: row.suggested_campaign_type,
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
         SELECT $1, $2, $3::jsonb
         WHERE NOT ($3::jsonb ? 'recommendationDecisionId') OR EXISTS (
           SELECT 1 FROM demeos_recommendation_decisions d
           WHERE d.business_id = $2 AND d.decision_id::text = $3::jsonb->>'recommendationDecisionId'
             AND d.decision IN ('used', 'modified'))
         ON CONFLICT (campaign_id) DO UPDATE SET campaign =
           CASE WHEN demeos_campaigns.campaign ? 'recommendationDecisionId'
             THEN jsonb_set(EXCLUDED.campaign, '{recommendationDecisionId}', demeos_campaigns.campaign->'recommendationDecisionId', true)
             ELSE EXCLUDED.campaign END, updated_at = NOW()
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
         SET campaign = jsonb_set(campaign, '{approvalStatus}', '"Approved"'::jsonb),
             approved_at = COALESCE(approved_at, NOW()), updated_at = NOW()
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
        `UPDATE demeos_campaigns SET campaign = jsonb_set(campaign, '{outcome}',
           $3::jsonb || CASE WHEN campaign ? 'recommendationDecisionId'
             THEN jsonb_build_object('recommendationDecisionId', campaign->'recommendationDecisionId')
             ELSE '{}'::jsonb END, true), updated_at = NOW()
         WHERE campaign_id = $1 AND business_id = $2 AND campaign->>'approvalStatus' = 'Approved' RETURNING campaign`,
        [campaignId, businessId, JSON.stringify(outcome)]);
      return result.rows.length ? { ...result.rows[0].campaign, id: campaignId, businessId } : null;
    },

    async saveRecommendationDecision(decision) {
      await database.ensureSchema();
      const result = await database.query(
        `INSERT INTO demeos_recommendation_decisions
           (business_id, recommendation_id, recommendation_title, suggested_campaign_type, decision, decided_at)
         SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (SELECT 1 FROM demeos_businesses WHERE business_id = $1)
         RETURNING decision_id, recommendation_id, recommendation_title, suggested_campaign_type, decision, decided_at`,
        [decision.businessId, decision.recommendationId, decision.recommendationTitle, decision.suggestedCampaignType, decision.decision, decision.timestamp]);
      if (!result.rows.length) return null;
      const row = result.rows[0];
      return { decisionId: String(row.decision_id), recommendationId: row.recommendation_id, businessId: decision.businessId, recommendationTitle: row.recommendation_title,
        suggestedCampaignType: row.suggested_campaign_type, decision: row.decision,
        timestamp: row.decided_at instanceof Date ? row.decided_at.toISOString() : row.decided_at };
    },

    async getCustomerWork() {
      await database.ensureSchema();
      const pageSize = 50;
      const publicWork = [];
      let offset = 0;
      while (publicWork.length < 20) {
        const result = await database.query(
          `SELECT c.campaign_id, c.business_id, c.campaign, b.profile FROM demeos_campaigns c
           JOIN demeos_businesses b ON b.business_id = c.business_id
           WHERE c.campaign->>'approvalStatus' = 'Approved'
             AND c.campaign->>'campaignType' IN ('full', 'social', 'email')
             AND COALESCE(BTRIM(c.campaign->>'campaignText'), '') <> ''
           ORDER BY c.updated_at DESC, c.campaign_id DESC
           LIMIT $1 OFFSET $2`, [pageSize, offset]);
        for (const row of result.rows) {
          if (!canPublishToDemeosCustomerExperience(row.campaign)) continue;
          const publicItem = toPublicCustomerWorkItem({
            workItemId: row.campaign_id,
            businessName: row.profile && row.profile.name,
            location: row.profile && row.profile.location,
            content: getCustomerFacingContent(row.campaign),
            participationAction: "Interested",
            customerContinuation: row.profile && row.profile.profileVersion >= 2 ? row.profile.customerContinuation : undefined,
            fulfilment: row.profile && row.profile.profileVersion >= 2 ? row.profile.fulfilment : undefined,
            operationalAvailability: row.profile && row.profile.profileVersion >= 3 ? row.profile.operationalAvailability : undefined,
            products: row.profile && row.profile.profileVersion >= 4 ? row.profile.products : undefined,
            businessId: row.business_id,
            informationSource: row.profile && row.profile.profileVersion >= 2 && row.profile.informationStatus && row.profile.informationStatus.status === "business-provided" ? "business-provided" : undefined
          });
          if (!publicItem) continue;
          publicWork.push(publicItem);
          if (publicWork.length === 20) break;
        }
        if (result.rows.length < pageSize) break;
        offset += pageSize;
      }
      return publicWork;
    },

    async recordCustomerParticipation(campaignId, action, trustedCustomerIdentityId = null) {
      if (!isNonEmptyString(trustedCustomerIdentityId) || action !== "Interested") return null;
      await database.ensureSchema();
      const campaignResult = await database.query(
        `SELECT business_id, campaign FROM demeos_campaigns WHERE campaign_id = $1`, [campaignId]);
      if (!campaignResult.rows.length || !canPublishToDemeosCustomerExperience(campaignResult.rows[0].campaign)) return null;
      const result = await database.query(
        `WITH customer_work_lock AS (
           SELECT pg_advisory_xact_lock(hashtext($4 || ':' || $1))
         ), inserted AS (
         INSERT INTO demeos_customer_participations
           (business_id, campaign_id, action, trusted_customer_identity_id, evidence_type, source)
         SELECT c.business_id, c.campaign_id, $2, $4, 'customer-participation', 'customer-interested-action'
         FROM demeos_campaigns c
         JOIN demeos_customer_possibility_issuances i ON i.work_item_id = c.campaign_id
           AND i.trusted_customer_identity_id = $4 AND i.campaign_snapshot = c.campaign
         CROSS JOIN customer_work_lock
         WHERE c.campaign_id = $1 AND c.campaign->>'approvalStatus' = 'Approved'
           AND c.campaign = $3::jsonb
           AND NOT EXISTS (SELECT 1 FROM demeos_customer_participations p
             WHERE p.campaign_id = c.campaign_id AND p.business_id = c.business_id
               AND p.trusted_customer_identity_id = $4 AND p.action = 'Interested')
         RETURNING business_id, campaign_id, action, evidence_type, source, participated_at
         ) SELECT * FROM inserted UNION ALL
         SELECT p.business_id, p.campaign_id, p.action, p.evidence_type, p.source, p.participated_at
         FROM demeos_customer_participations p
         WHERE p.campaign_id = $1 AND p.business_id = $5
           AND p.trusted_customer_identity_id = $4 AND p.action = 'Interested'
         LIMIT 1`,
        [campaignId, action, JSON.stringify(campaignResult.rows[0].campaign),
          trustedCustomerIdentityId, campaignResult.rows[0].business_id]);
      return result.rows.length ? result.rows[0] : null;
    },

    async getCustomerParticipations(trustedCustomerIdentityId, limit = 50) {
      if (!isNonEmptyString(trustedCustomerIdentityId)) return [];
      await database.ensureSchema();
      const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 50));
      const result = await database.query(
        `SELECT p.action, p.participated_at, c.campaign_id, c.campaign, b.profile
         FROM demeos_customer_participations p
         JOIN demeos_campaigns c ON c.campaign_id = p.campaign_id
         JOIN demeos_businesses b ON b.business_id = p.business_id
         WHERE p.trusted_customer_identity_id = $1
         ORDER BY p.participated_at DESC, p.participation_id DESC LIMIT $2`,
        [trustedCustomerIdentityId, safeLimit]);
      return result.rows.map(function (row) {
        const participation = { action: "Interested",
          participatedAt: row.participated_at instanceof Date ? row.participated_at.toISOString() : row.participated_at };
        // Unpublished work remains truthful minimal evidence. Public display facts
        // are included only when they are still authoritative and publishable.
        if (!canPublishToDemeosCustomerExperience(row.campaign)) return participation;
        const publicItem = toPublicCustomerWorkItem({ workItemId: row.campaign_id,
          businessName: row.profile && row.profile.name, location: row.profile && row.profile.location,
          content: getCustomerFacingContent(row.campaign), participationAction: "Interested" });
        if (!publicItem) return participation;
        participation.content = publicItem.content;
        participation.businessName = publicItem.businessName;
        if (publicItem.location) participation.location = publicItem.location;
        return participation;
      });
    },

    // Feedback, owner-recorded outcomes, recommendation decisions, and Interested
    // participation are distinct evidence sources. They must never become a generic
    // success signal or silently change recommendation or business conclusions.
    async getCustomerFeedback(trustedCustomerIdentityId, limit = 50) {
      if (!isNonEmptyString(trustedCustomerIdentityId)) return [];
      await database.ensureSchema();
      const safeLimit = Math.min(50, Math.max(1, Number(limit) || 50));
      const result = await database.query(
        `SELECT f.response, f.comment, f.created_at, c.campaign
         FROM demeos_customer_feedback f
         JOIN demeos_campaigns c ON c.campaign_id = f.campaign_id AND c.business_id = f.business_id
         WHERE f.trusted_customer_identity_id = $1 AND f.feedback_type = 'possibility-relevance'
         ORDER BY f.created_at DESC, f.feedback_id DESC LIMIT $2`,
        [trustedCustomerIdentityId, safeLimit]);
      return result.rows.map(function (row) {
        const item = { response: row.response, possibilityContent: getCustomerFacingContent(row.campaign),
          evidenceType: "customer-feedback", source: "authenticated-customer",
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
        if (isNonEmptyString(row.comment)) item.comment = row.comment;
        return item;
      }).filter(function (item) { return isNonEmptyString(item.possibilityContent); });
    },

    async recordCustomerFeedback(campaignId, feedback, trustedCustomerIdentityId = null) {
      if (!isNonEmptyString(trustedCustomerIdentityId)) return null;
      await database.ensureSchema();
      const campaignResult = await database.query(
        `SELECT business_id, campaign FROM demeos_campaigns WHERE campaign_id = $1`, [campaignId]);
      if (!campaignResult.rows.length || !canPublishToDemeosCustomerExperience(campaignResult.rows[0].campaign)) return null;
      const stored = campaignResult.rows[0];
      const result = await database.query(
        `WITH customer_work_lock AS (
           SELECT pg_advisory_xact_lock(hashtext($7 || ':' || $1 || ':feedback'))
         ), inserted AS (
         INSERT INTO demeos_customer_feedback
           (business_id, campaign_id, feedback_type, response, comment, trusted_customer_identity_id,
            evidence_type, source)
         SELECT c.business_id, c.campaign_id, $2, $3, $4, $7,
                'customer-feedback', 'customer-feedback-action'
         FROM demeos_campaigns c
         JOIN demeos_customer_possibility_issuances i ON i.work_item_id = c.campaign_id
           AND i.trusted_customer_identity_id = $7 AND i.campaign_snapshot = c.campaign
         CROSS JOIN customer_work_lock
         WHERE c.campaign_id = $1 AND c.business_id = $5
           AND c.campaign->>'approvalStatus' = 'Approved' AND c.campaign = $6::jsonb
           AND NOT EXISTS (SELECT 1 FROM demeos_customer_feedback f
             WHERE f.campaign_id = c.campaign_id AND f.business_id = c.business_id
               AND f.trusted_customer_identity_id = $7 AND f.feedback_type = $2
               AND f.response = $3 AND f.comment IS NOT DISTINCT FROM $4)
         RETURNING response, evidence_type, source, created_at
         ) SELECT * FROM inserted UNION ALL
         SELECT f.response, f.evidence_type, f.source, f.created_at FROM demeos_customer_feedback f
         WHERE f.campaign_id = $1 AND f.business_id = $5 AND f.trusted_customer_identity_id = $7
           AND f.feedback_type = $2 AND f.response = $3 AND f.comment IS NOT DISTINCT FROM $4
         ORDER BY created_at DESC LIMIT 1`,
        [campaignId, feedback.feedbackType, feedback.response, feedback.comment || null,
          stored.business_id, JSON.stringify(stored.campaign),
          trustedCustomerIdentityId]);
      return result.rows.length ? { response: result.rows[0].response } : null;
    }
  };
}

function toSavedPossibility(row) {
  const saved = { savedPossibilityId: String(row.saved_possibility_id), content: row.possibility_content, businessName: row.business_name,
    relevance: { basis: row.relevance_basis },
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
  if (row.location) saved.location = row.location;
  return saved;
}

function toCustomerPreference(row) {
  return { preferenceId: String(row.preference_id), preference: row.preference_text,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
}

let defaultRepository;
function getRepository() {
  if (!defaultRepository) defaultRepository = createPersistenceRepository(getDatabase());
  return defaultRepository;
}

module.exports = { createPersistenceRepository, getRepository, getCustomerFacingContent };
