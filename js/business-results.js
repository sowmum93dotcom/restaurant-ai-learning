function getBusinessResults(record, activeBusinessId) {
  if (!record || !activeBusinessId || !record.businessProfile ||
      record.businessProfile.businessId !== activeBusinessId) return [];

  const campaigns = Array.isArray(record.campaigns) ? record.campaigns : [];
  const participation = Array.isArray(record.customerParticipationResults)
    ? record.customerParticipationResults : [];
  const participationByCampaign = new Map(participation.filter(function (result) {
    return result && result.businessId === activeBusinessId && typeof result.workItemId === "string";
  }).map(function (result) { return [result.workItemId, result]; }));

  return campaigns.filter(function (campaign) {
    if (!campaign || campaign.businessId !== activeBusinessId) return false;
    const signal = participationByCampaign.get(campaign.id);
    return Boolean(campaign.outcome && typeof campaign.outcome.outcome === "string") || Boolean(signal);
  }).map(function (campaign) {
    const signal = participationByCampaign.get(campaign.id);
    return {
      campaignId: campaign.id,
      name: (typeof campaign.promoText === "string" && campaign.promoText.trim()) ||
        campaign.campaignTypeLabel || campaign.campaignType || "Campaign",
      type: campaign.campaignTypeLabel || campaign.campaignType || "Campaign type unavailable",
      status: campaign.approvalStatus || "Status unavailable",
      outcome: campaign.outcome ? campaign.outcome.outcome : null,
      ownerNote: campaign.outcome && typeof campaign.outcome.ownerNote === "string"
        ? campaign.outcome.ownerNote : "",
      customerInterestCount: signal ? Number(signal.customerInterestCount) : 0,
      latestParticipationAt: signal ? signal.latestParticipationAt || null : null
    };
  });
}

function getRecommendationDecisions(record, activeBusinessId) {
  if (!record || !activeBusinessId || !record.businessProfile ||
      record.businessProfile.businessId !== activeBusinessId) return [];

  const decisionLabels = { used: "Used", modified: "Modified", rejected: "Not for me" };
  const campaignLabels = {
    full: "Full Marketing Campaign",
    social: "Social Media Campaign",
    email: "Email Campaign"
  };
  const decisions = Array.isArray(record.recommendationDecisions) ? record.recommendationDecisions : [];

  return decisions.filter(function (item) {
    if (!item || item.businessId !== activeBusinessId ||
        typeof item.recommendationTitle !== "string" || !item.recommendationTitle.trim() ||
        !Object.hasOwn(campaignLabels, item.suggestedCampaignType) ||
        !Object.hasOwn(decisionLabels, item.decision) || typeof item.timestamp !== "string") return false;
    return Number.isFinite(Date.parse(item.timestamp));
  }).map(function (item) {
    return {
      recommendationTitle: item.recommendationTitle.trim(),
      campaignType: campaignLabels[item.suggestedCampaignType],
      ownerDecision: decisionLabels[item.decision],
      timestamp: item.timestamp
    };
  }).sort(function (left, right) {
    return Date.parse(right.timestamp) - Date.parse(left.timestamp);
  });
}

function getDemeosUnderstanding(record, activeBusinessId) {
  const empty = { campaignOutcomeCount: 0, customerInterestCount: 0,
    campaignsWithCustomerParticipation: 0,
    recommendationDecisions: { used: 0, modified: 0, rejected: 0 }, evidenceAvailable: false };
  if (!record || !activeBusinessId || !record.businessProfile ||
      record.businessProfile.businessId !== activeBusinessId) return empty;

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
  return { campaignOutcomeCount, customerInterestCount,
    campaignsWithCustomerParticipation: new Set(participation.map(function (result) { return result.workItemId; })).size,
    recommendationDecisions,
    evidenceAvailable: campaignOutcomeCount > 0 || participation.length > 0 || decisionCount > 0 };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getBusinessResults, getRecommendationDecisions, getDemeosUnderstanding };
}

if (typeof document !== "undefined") {
  const byId = function (id) { return document.getElementById(id); };
  const status = byId("business-results-status");
  const zero = byId("business-results-zero");
  const list = byId("business-results-list");
  const decisionsEmpty = byId("recommendation-decisions-empty");
  const decisionsList = byId("recommendation-decisions-list");

  function addText(parent, tag, text, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
  }

  function render(results) {
    list.textContent = "";
    zero.hidden = results.length > 0;
    results.forEach(function (result) {
      const card = document.createElement("article");
      card.className = "business-result-card";
      addText(card, "h3", result.name);
      addText(card, "p", `${result.type} · ${result.status}`, "business-result-meta");
      const details = document.createElement("div"); details.className = "business-result-details";
      const outcome = document.createElement("section"); outcome.className = "business-result-section";
      addText(outcome, "h4", "Recorded outcome");
      addText(outcome, "p", result.outcome || "No owner outcome recorded.");
      if (result.ownerNote) addText(outcome, "p", result.ownerNote);
      const participation = document.createElement("section"); participation.className = "business-result-section";
      addText(participation, "h4", "Customer participation");
      addText(participation, "p", `${result.customerInterestCount} interested participation${result.customerInterestCount === 1 ? "" : "s"} recorded`);
      if (result.latestParticipationAt) {
        addText(participation, "p", `Latest participation: ${new Date(result.latestParticipationAt).toLocaleString()}`);
      }
      details.append(outcome, participation); card.appendChild(details); list.appendChild(card);
    });
  }

  function renderRecommendationDecisions(decisions) {
    decisionsList.textContent = "";
    decisionsEmpty.hidden = decisions.length > 0;
    decisions.forEach(function (decision) {
      const card = document.createElement("article");
      card.className = "recommendation-decision-card";
      addText(card, "h4", decision.recommendationTitle);
      addText(card, "p", `Campaign type: ${decision.campaignType}`);
      addText(card, "p", `Owner decision: ${decision.ownerDecision}`);
      addText(card, "p", `Decision date: ${new Date(decision.timestamp).toLocaleString()}`);
      decisionsList.appendChild(card);
    });
  }

  function renderDemeosUnderstanding(understanding) {
    byId("demeos-understanding-state").textContent = understanding.evidenceAvailable
      ? "Understanding is growing" : "Building understanding";
    byId("demeos-understanding-outcomes").textContent = understanding.campaignOutcomeCount;
    byId("demeos-understanding-interest").textContent = understanding.customerInterestCount;
    byId("demeos-understanding-participation-campaigns").textContent = understanding.campaignsWithCustomerParticipation;
    byId("demeos-understanding-used").textContent = understanding.recommendationDecisions.used;
    byId("demeos-understanding-modified").textContent = understanding.recommendationDecisions.modified;
    byId("demeos-understanding-rejected").textContent = understanding.recommendationDecisions.rejected;
  }

  async function load() {
    const businessId = localStorage.getItem("demeosActiveBusinessId");
    if (!businessId) { status.textContent = "No active business selected."; zero.hidden = false; return; }
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}`);
      if (!response.ok) throw new Error("Stored business results could not be loaded.");
      const record = await response.json();
      const results = getBusinessResults(record, businessId);
      const decisions = getRecommendationDecisions(record, businessId);
      const understanding = getDemeosUnderstanding(record, businessId);
      const name = record.businessProfile && record.businessProfile.name;
      if (name) byId("business-results-business-name").textContent = name;
      status.textContent = results.length ? `${results.length} campaign result${results.length === 1 ? "" : "s"}` : "";
      render(results);
      renderDemeosUnderstanding(understanding);
      renderRecommendationDecisions(decisions);
    } catch (error) {
      status.textContent = error.message;
      zero.hidden = false;
    }
  }
  load();
}
