function getBusinessResults(record, activeBusinessId) {
  if (!record || !activeBusinessId || !record.businessProfile ||
      record.businessProfile.businessId !== activeBusinessId) return [];

  const campaigns = Array.isArray(record.campaigns) ? record.campaigns : [];
  const participation = Array.isArray(record.customerParticipationResults)
    ? record.customerParticipationResults : [];
  const participationByCampaign = new Map(participation.filter(function (result) {
    return result && result.businessId === activeBusinessId && typeof result.workItemId === "string";
  }).map(function (result) { return [result.workItemId, result]; }));
  const feedback = Array.isArray(record.customerFeedbackResults) ? record.customerFeedbackResults : [];
  const feedbackByCampaign = new Map(feedback.filter(function (result) {
    return result && result.businessId === activeBusinessId && typeof result.workItemId === "string";
  }).map(function (result) { return [result.workItemId, result]; }));
  const decisions = new Map((Array.isArray(record.recommendationDecisions) ? record.recommendationDecisions : [])
    .filter(function (decision) {
      return decision && decision.businessId === activeBusinessId && decision.decisionId != null;
    }).map(function (decision) { return [String(decision.decisionId), decision]; }));

  return campaigns.filter(function (campaign) {
    if (!campaign || campaign.businessId !== activeBusinessId) return false;
    const signal = participationByCampaign.get(campaign.id);
    const customerFeedback = feedbackByCampaign.get(campaign.id);
    return campaign.approvalStatus === "Approved" ||
      Boolean(campaign.outcome && typeof campaign.outcome.outcome === "string") || Boolean(signal) || Boolean(customerFeedback);
  }).map(function (campaign) {
    const signal = participationByCampaign.get(campaign.id);
    const customerFeedback = feedbackByCampaign.get(campaign.id);
    const linkedDecision = campaign.recommendationDecisionId != null
      ? decisions.get(String(campaign.recommendationDecisionId)) : null;
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
      latestParticipationAt: signal ? signal.latestParticipationAt || null : null,
      feedback: {
        relevant: customerFeedback ? Math.max(0, Number(customerFeedback.relevantCount) || 0) : 0,
        notQuite: customerFeedback ? Math.max(0, Number(customerFeedback.notQuiteCount) || 0) : 0,
        somethingDifferent: customerFeedback ? Math.max(0, Number(customerFeedback.somethingDifferentCount) || 0) : 0,
        recorded: Boolean(customerFeedback && customerFeedback.latestFeedbackAt),
        latestFeedbackAt: customerFeedback ? customerFeedback.latestFeedbackAt || null : null
      },
      recommendation: linkedDecision && typeof linkedDecision.recommendationTitle === "string"
        ? linkedDecision.recommendationTitle : null,
      recommendationDecisionId: campaign.recommendationDecisionId != null
        ? String(campaign.recommendationDecisionId) : null
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

const getDemeosUnderstanding = typeof module !== "undefined" && module.exports
  ? require("./demeos-understanding.js").getDemeosUnderstanding
  : DemeosUnderstanding.getDemeosUnderstanding;

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
      if (result.recommendation) addText(card, "p", `Created from DEMEOS recommendation: ${result.recommendation}`, "business-result-provenance");
      addText(outcome, "h4", "Owner-recorded outcome");
      addText(outcome, "p", result.outcome || "No owner-recorded outcome yet. Absence is not failure.");
      if (result.ownerNote) addText(outcome, "p", result.ownerNote);
      const participation = document.createElement("section"); participation.className = "business-result-section";
      addText(participation, "h4", "Customer participation");
      addText(participation, "p", result.latestParticipationAt
        ? `${result.customerInterestCount} Interested action${result.customerInterestCount === 1 ? "" : "s"} recorded`
        : "No Interested evidence recorded yet. Absence does not mean lack of demand.");
      if (result.latestParticipationAt) {
        addText(participation, "p", `Latest participation: ${new Date(result.latestParticipationAt).toLocaleString()}`);
      }
      const feedback = document.createElement("section"); feedback.className = "business-result-section";
      addText(feedback, "h4", "Customer Feedback");
      if (result.feedback.recorded) {
        addText(feedback, "p", `Relevant: ${result.feedback.relevant}`);
        addText(feedback, "p", `Not quite: ${result.feedback.notQuite}`);
        addText(feedback, "p", `Something different: ${result.feedback.somethingDifferent}`);
        addText(feedback, "p", `Latest feedback: ${new Date(result.feedback.latestFeedbackAt).toLocaleString()}`);
      } else {
        addText(feedback, "p", "No Customer Feedback recorded yet. Absence is not a negative opinion.");
      }
      details.append(participation, feedback, outcome); card.appendChild(details); list.appendChild(card);
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
    byId("demeos-understanding-feedback-relevant").textContent = understanding.customerFeedback.relevant;
    byId("demeos-understanding-feedback-not-quite").textContent = understanding.customerFeedback.notQuite;
    byId("demeos-understanding-feedback-something-different").textContent = understanding.customerFeedback.somethingDifferent;
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
