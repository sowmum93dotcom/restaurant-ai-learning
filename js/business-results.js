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
    return Boolean(campaign.outcome && typeof campaign.outcome.outcome === "string") ||
      Boolean(signal && signal.customerInterestCount > 0);
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

if (typeof module !== "undefined" && module.exports) module.exports = { getBusinessResults };

if (typeof document !== "undefined") {
  const byId = function (id) { return document.getElementById(id); };
  const status = byId("business-results-status");
  const zero = byId("business-results-zero");
  const list = byId("business-results-list");

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

  async function load() {
    const businessId = localStorage.getItem("demeosActiveBusinessId");
    if (!businessId) { status.textContent = "No active business selected."; zero.hidden = false; return; }
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}`);
      if (!response.ok) throw new Error("Stored business results could not be loaded.");
      const record = await response.json();
      const results = getBusinessResults(record, businessId);
      const name = record.businessProfile && record.businessProfile.name;
      if (name) byId("business-results-business-name").textContent = name;
      status.textContent = results.length ? `${results.length} campaign result${results.length === 1 ? "" : "s"}` : "";
      render(results);
    } catch (error) {
      status.textContent = error.message;
      zero.hidden = false;
    }
  }
  load();
}
