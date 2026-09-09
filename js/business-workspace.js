function parseWorkspaceValue(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function getOwnerWorkspaceContext(storage) {
  const activeBusinessId = storage.getItem("demeosActiveBusinessId");
  const profiles = parseWorkspaceValue(storage, "demeosBusinessProfiles", []);
  const campaigns = parseWorkspaceValue(storage, "demeosCampaignHistory", []);
  if (!activeBusinessId || !Array.isArray(profiles)) return { profile: null, currentWork: [] };

  const profile = profiles.find(function (item) {
    return item && item.businessId === activeBusinessId;
  }) || null;
  if (!profile) return { profile: null, currentWork: [] };

  const currentWork = (Array.isArray(campaigns) ? campaigns : []).filter(function (campaign) {
    return campaign && campaign.businessId === activeBusinessId;
  }).slice(-3).reverse().map(function (campaign) {
    return {
      name: (typeof campaign.promoText === "string" && campaign.promoText.trim()) ||
        campaign.campaignTypeLabel || campaign.campaignType || "Marketing work",
      status: campaign.approvalStatus || "Status not recorded"
    };
  });
  return { profile, currentWork };
}

if (typeof module !== "undefined" && module.exports) module.exports = { getOwnerWorkspaceContext };

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  const context = getOwnerWorkspaceContext(localStorage);
  const identity = document.getElementById("workspace-business-identity");
  const work = document.getElementById("workspace-current-work");
  if (!context.profile) {
    identity.textContent = "No saved business is selected.";
    work.textContent = "Save a Business Profile before starting work in DEMEOS.";
    return;
  }

  const name = context.profile.name || "Saved business";
  document.getElementById("workspace-header-business").textContent = name;
  const heading = document.createElement("strong");
  heading.textContent = name;
  identity.appendChild(heading);
  [context.profile.type, context.profile.location].filter(function (value) {
    return typeof value === "string" && value.trim();
  }).forEach(function (value) {
    const detail = document.createElement("span");
    detail.textContent = value;
    identity.appendChild(detail);
  });

  if (!context.currentWork.length) {
    work.textContent = "No marketing work is stored for this business yet.";
    return;
  }
  context.currentWork.forEach(function (item) {
    const row = document.createElement("article");
    const title = document.createElement("strong");
    const status = document.createElement("span");
    title.textContent = item.name;
    status.textContent = item.status;
    row.append(title, status);
    work.appendChild(row);
  });
});
