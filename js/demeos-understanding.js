(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DemeosUnderstanding = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const requiredProfileFields = ["name", "type", "location", "brandVoice", "targetCustomer", "goal"];

  function recordedEvidence(items, timestampField, source, evidenceType) {
    return items.filter(function (item) {
      return item && typeof item[timestampField] === "string" && Number.isFinite(Date.parse(item[timestampField]));
    }).map(function (item) {
      return { recordedAt: item[timestampField], source: item.source || source,
        evidenceType: item.evidenceType || evidenceType };
    });
  }

  function withEvidenceContext(summary, evidenceContext) {
    Object.defineProperty(summary, "evidenceContext", { value: evidenceContext, enumerable: false });
    return summary;
  }

  function getDemeosUnderstanding(record, activeBusinessId) {
    const empty = { verifiedBusinessProfile: false, campaignOutcomeCount: 0, customerInterestCount: 0,
      campaignsWithCustomerParticipation: 0,
      customerFeedback: { relevant: 0, notQuite: 0, somethingDifferent: 0 },
      recommendationDecisions: { used: 0, modified: 0, rejected: 0 }, evidenceAvailable: false };
    withEvidenceContext(empty, { current: [], historical: [], absent: ["business-profile", "approved-work",
      "owner-recorded-outcome", "customer-participation", "customer-feedback", "recommendation-decision"] });
    if (!record || !activeBusinessId || !record.businessProfile ||
        record.businessProfile.businessId !== activeBusinessId) return empty;

    const verifiedBusinessProfile = requiredProfileFields.every(function (field) {
      return typeof record.businessProfile[field] === "string" && Boolean(record.businessProfile[field].trim());
    });
    const campaigns = Array.isArray(record.campaigns) ? record.campaigns : [];
    const activeCampaignIds = new Set(campaigns.filter(function (campaign) {
      return campaign && campaign.businessId === activeBusinessId && typeof campaign.id === "string";
    }).map(function (campaign) { return campaign.id; }));
    const campaignOutcomeCount = campaigns.filter(function (campaign) {
      return campaign && campaign.businessId === activeBusinessId && campaign.outcome &&
        typeof campaign.outcome.outcome === "string";
    }).length;
    const participation = (Array.isArray(record.customerParticipationResults)
      ? record.customerParticipationResults : []).filter(function (result) {
      return result && result.businessId === activeBusinessId && activeCampaignIds.has(result.workItemId) &&
        Number.isFinite(Number(result.customerInterestCount)) && Number(result.customerInterestCount) >= 0;
    });
    const customerInterestCount = participation.reduce(function (total, result) {
      return total + Number(result.customerInterestCount);
    }, 0);
    const feedback = (Array.isArray(record.customerFeedbackResults) ? record.customerFeedbackResults : []).filter(function (result) {
      return result && result.businessId === activeBusinessId && activeCampaignIds.has(result.workItemId);
    });
    const customerFeedback = feedback.reduce(function (counts, result) {
      counts.relevant += Math.max(0, Number(result.relevantCount) || 0);
      counts.notQuite += Math.max(0, Number(result.notQuiteCount) || 0);
      counts.somethingDifferent += Math.max(0, Number(result.somethingDifferentCount) || 0);
      return counts;
    }, { relevant: 0, notQuite: 0, somethingDifferent: 0 });
    const recommendationDecisions = { used: 0, modified: 0, rejected: 0 };
    (Array.isArray(record.recommendationDecisions) ? record.recommendationDecisions : []).forEach(function (item) {
      if (item && item.businessId === activeBusinessId &&
          Object.hasOwn(recommendationDecisions, item.decision)) recommendationDecisions[item.decision] += 1;
    });
    const decisionCount = recommendationDecisions.used + recommendationDecisions.modified + recommendationDecisions.rejected;
    const approvedWork = campaigns.filter(function (campaign) {
      return campaign && campaign.businessId === activeBusinessId && campaign.approvalStatus === "Approved";
    });
    const outcomes = campaigns.filter(function (campaign) { return campaign && campaign.businessId === activeBusinessId && campaign.outcome; });
    const historical = []
      .concat(recordedEvidence(approvedWork, "approvedAt", "business-owner-approval", "approved-work"))
      .concat(recordedEvidence(outcomes.map(function (campaign) {
        return { savedAt: campaign.outcome.savedAt, source: "business-owner", evidenceType: "owner-recorded-outcome" };
      }), "savedAt", "business-owner", "owner-recorded-outcome"))
      .concat(recordedEvidence(participation, "latestParticipationAt", "customer-interested-action", "customer-participation"))
      .concat(recordedEvidence(feedback, "latestFeedbackAt", "customer-feedback-action", "customer-feedback"))
      .concat(recordedEvidence((record.recommendationDecisions || []).filter(function (item) {
        return item && item.businessId === activeBusinessId;
      }), "timestamp", "business-owner", "recommendation-decision"));
    const presentTypes = new Set(historical.map(function (item) { return item.evidenceType; }));
    const absent = ["approved-work", "owner-recorded-outcome", "customer-participation", "customer-feedback",
      "recommendation-decision"].filter(function (type) { return !presentTypes.has(type); });
    return withEvidenceContext({ verifiedBusinessProfile, campaignOutcomeCount, customerInterestCount,
      campaignsWithCustomerParticipation: new Set(participation.map(function (result) { return result.workItemId; })).size,
      customerFeedback,
      recommendationDecisions,
      evidenceAvailable: campaignOutcomeCount > 0 || participation.length > 0 || decisionCount > 0 ||
        customerFeedback.relevant > 0 || customerFeedback.notQuite > 0 || customerFeedback.somethingDifferent > 0 },
    { current: verifiedBusinessProfile ? [{ evidenceType: "business-profile", source: "business-owner" }] : [],
      historical, absent });
  }

  return { getDemeosUnderstanding };
}));
