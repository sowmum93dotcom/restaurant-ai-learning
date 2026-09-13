(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DemeosUnderstanding = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const requiredProfileFields = ["name", "type", "location", "brandVoice", "targetCustomer", "goal"];

  function getDemeosUnderstanding(record, activeBusinessId) {
    const empty = { verifiedBusinessProfile: false, campaignOutcomeCount: 0, customerInterestCount: 0,
      campaignsWithCustomerParticipation: 0,
      recommendationDecisions: { used: 0, modified: 0, rejected: 0 }, evidenceAvailable: false };
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
    const recommendationDecisions = { used: 0, modified: 0, rejected: 0 };
    (Array.isArray(record.recommendationDecisions) ? record.recommendationDecisions : []).forEach(function (item) {
      if (item && item.businessId === activeBusinessId &&
          Object.hasOwn(recommendationDecisions, item.decision)) recommendationDecisions[item.decision] += 1;
    });
    const decisionCount = recommendationDecisions.used + recommendationDecisions.modified + recommendationDecisions.rejected;
    return { verifiedBusinessProfile, campaignOutcomeCount, customerInterestCount,
      campaignsWithCustomerParticipation: new Set(participation.map(function (result) { return result.workItemId; })).size,
      recommendationDecisions,
      evidenceAvailable: campaignOutcomeCount > 0 || participation.length > 0 || decisionCount > 0 };
  }

  return { getDemeosUnderstanding };
}));
