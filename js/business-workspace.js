function parseWorkspaceValue(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function createWorkspaceBusinessId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `business-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function migrateWorkspaceBusinessContext(storage) {
  const storedProfiles = parseWorkspaceValue(storage, "demeosBusinessProfiles", []);
  const profiles = Array.isArray(storedProfiles) ? storedProfiles.slice() : [];
  let legacyProfile = parseWorkspaceValue(storage, "demeosBusinessProfile", null);
  let activeBusinessId = storage.getItem("demeosActiveBusinessId");
  let changed = !Array.isArray(storedProfiles);

  if (legacyProfile && typeof legacyProfile === "object" && !Array.isArray(legacyProfile)) {
    if (!legacyProfile.businessId) {
      legacyProfile = { ...legacyProfile, businessId: createWorkspaceBusinessId() };
      if (typeof storage.setItem === "function") storage.setItem("demeosBusinessProfile", JSON.stringify(legacyProfile));
    }
    if (!profiles.some(function (profile) { return profile && profile.businessId === legacyProfile.businessId; })) {
      profiles.push(legacyProfile);
      activeBusinessId = legacyProfile.businessId;
      changed = true;
    }
  }

  if (!profiles.some(function (profile) { return profile && profile.businessId === activeBusinessId; })) {
    activeBusinessId = profiles.length ? profiles[0].businessId : null;
  }

  if (typeof storage.setItem === "function") {
    if (changed || storage.getItem("demeosBusinessProfiles") === null) {
      storage.setItem("demeosBusinessProfiles", JSON.stringify(profiles));
    }
    if (activeBusinessId) storage.setItem("demeosActiveBusinessId", activeBusinessId);
    else if (typeof storage.removeItem === "function") storage.removeItem("demeosActiveBusinessId");
  }

  return { profiles, activeBusinessId };
}

function getOwnerWorkspaceContext(storage) {
  const migrated = migrateWorkspaceBusinessContext(storage);
  const activeBusinessId = migrated.activeBusinessId;
  const profiles = migrated.profiles;
  const campaigns = parseWorkspaceValue(storage, "demeosCampaignHistory", []);
  if (!activeBusinessId || !Array.isArray(profiles)) return { profile: null, currentWork: [] };

  const profile = profiles.find(function (item) {
    return item && item.businessId === activeBusinessId;
  }) || null;
  if (!profile) return { profile: null, currentWork: [] };

  const currentWork = (Array.isArray(campaigns) ? campaigns : []).filter(function (campaign) {
    return campaign && campaign.businessId === activeBusinessId;
  }).slice(0, 3).map(function (campaign) {
    return {
      name: (typeof campaign.promoText === "string" && campaign.promoText.trim()) ||
        campaign.campaignTypeLabel || campaign.campaignType || "Marketing work",
      status: campaign.approvalStatus || "Status not recorded"
    };
  });
  return { profile, currentWork };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getOwnerWorkspaceContext, migrateWorkspaceBusinessContext };
}

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
