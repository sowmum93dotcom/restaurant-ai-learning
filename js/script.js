function getCampaignContinuity(campaign) {
  const revisionNumber = Number.isInteger(campaign && campaign.revisionNumber) && campaign.revisionNumber >= 0
    ? campaign.revisionNumber : 0;
  return {
    originalMarketingWorkId: (campaign && campaign.originalMarketingWorkId) || (campaign && campaign.id) || null,
    revisionNumber
  };
}

function createCampaignContinuity(campaignId, sourceCampaign) {
  if (!sourceCampaign) return { originalMarketingWorkId: campaignId, revisionNumber: 0 };
  const source = getCampaignContinuity(sourceCampaign);
  return {
    originalMarketingWorkId: source.originalMarketingWorkId || campaignId,
    revisionNumber: source.revisionNumber + 1
  };
}

function getCampaignContinuityLabel(campaign) {
  const number = getCampaignContinuity(campaign).revisionNumber;
  return number === 0 ? "Original" : `Revision ${number}`;
}

function createBusinessId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `business-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addBusinessIdentity(profile, savedProfile) {
  return { ...profile, businessId: (savedProfile && savedProfile.businessId) || profile.businessId || createBusinessId() };
}

function parseStoredJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value === null ? fallback : value;
  } catch (error) {
    console.error(`Could not read ${key}:`, error);
    return fallback;
  }
}

const pendingBusinessProfileSyncKey = "demeosPendingBusinessProfileSync";

function readPendingBusinessProfileSyncIds(storage) {
  const stored = storage.getItem(pendingBusinessProfileSyncKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function (businessId, index) {
      return typeof businessId === "string" && businessId && parsed.indexOf(businessId) === index;
    });
  } catch (error) {
    const legacyBusinessId = stored.trim();
    return legacyBusinessId && !/^[\[{\"]/.test(legacyBusinessId) ? [legacyBusinessId] : [];
  }
}

function writePendingBusinessProfileSyncIds(storage, businessIds) {
  if (businessIds.length) storage.setItem(pendingBusinessProfileSyncKey, JSON.stringify(businessIds));
  else storage.removeItem(pendingBusinessProfileSyncKey);
}

function addPendingBusinessProfileSync(storage, businessId) {
  const businessIds = readPendingBusinessProfileSyncIds(storage);
  if (!businessIds.includes(businessId)) businessIds.push(businessId);
  writePendingBusinessProfileSyncIds(storage, businessIds);
}

function removePendingBusinessProfileSync(storage, businessId) {
  writePendingBusinessProfileSyncIds(storage, readPendingBusinessProfileSyncIds(storage).filter(function (pendingId) {
    return pendingId !== businessId;
  }));
}

function migrateBusinessProfiles(storage) {
  const storedProfiles = parseStoredJson(storage, "demeosBusinessProfiles", []);
  const profiles = Array.isArray(storedProfiles) ? storedProfiles.slice() : [];
  let legacyProfile = parseStoredJson(storage, "demeosBusinessProfile", null);
  let activeBusinessId = storage.getItem("demeosActiveBusinessId");
  let changed = !Array.isArray(storedProfiles);

  if (legacyProfile && typeof legacyProfile === "object" && !Array.isArray(legacyProfile)) {
    if (!legacyProfile.businessId) {
      legacyProfile = addBusinessIdentity(legacyProfile);
      storage.setItem("demeosBusinessProfile", JSON.stringify(legacyProfile));
    }
    if (!profiles.some(function (profile) { return profile.businessId === legacyProfile.businessId; })) {
      profiles.push(legacyProfile);
      activeBusinessId = legacyProfile.businessId;
      changed = true;
    }
  }

  if (!profiles.some(function (profile) { return profile.businessId === activeBusinessId; })) {
    activeBusinessId = profiles.length ? profiles[0].businessId : null;
  }
  if (changed || storage.getItem("demeosBusinessProfiles") === null) {
    storage.setItem("demeosBusinessProfiles", JSON.stringify(profiles));
  }
  if (activeBusinessId) storage.setItem("demeosActiveBusinessId", activeBusinessId);
  else storage.removeItem("demeosActiveBusinessId");
  return { profiles, activeBusinessId };
}

function updateBusinessProfile(profiles, profileFields, activeBusinessId, makeId) {
  const index = profiles.findIndex(function (profile) { return profile.businessId === activeBusinessId; });
  if (index < 0) {
    const newProfile = { ...profileFields, businessId: (makeId || createBusinessId)() };
    return { profiles: profiles.concat(newProfile), profile: newProfile };
  }
  const updated = { ...profileFields, businessId: profiles[index].businessId };
  const nextProfiles = profiles.slice();
  nextProfiles[index] = updated;
  return { profiles: nextProfiles, profile: updated };
}

function getCampaignBusinessId(profile, sourceCampaign) {
  return (sourceCampaign && sourceCampaign.businessId) || (profile && profile.businessId);
}
function canAccessCampaign(campaign, profile) {
  return Boolean(campaign) && (!campaign.businessId || Boolean(profile && profile.businessId && campaign.businessId === profile.businessId));
}
function getVisibleCampaigns(campaigns, profile) {
  return campaigns.filter(function (campaign) { return canAccessCampaign(campaign, profile); });
}
function getCampaignVersions(campaigns, campaign, profile) {
  if (!campaign || !canAccessCampaign(campaign, profile)) return [];
  const chainId = getCampaignContinuity(campaign).originalMarketingWorkId;
  return getVisibleCampaigns(campaigns, profile).filter(function (entry) {
    return getCampaignContinuity(entry).originalMarketingWorkId === chainId;
  }).sort(function (left, right) {
    const revisionDifference = getCampaignContinuity(left).revisionNumber - getCampaignContinuity(right).revisionNumber;
    return revisionDifference || String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
  });
}
function enforceBusinessCampaignLimit(campaigns, businessId, maximumCampaigns, protectedCampaignIds) {
  const retained = campaigns.slice();
  const protectedIds = new Set((protectedCampaignIds || []).filter(Boolean));
  let count = retained.filter(function (campaign) { return campaign.businessId === businessId; }).length;
  for (let index = retained.length - 1; count > maximumCampaigns && index >= 0; index -= 1) {
    if (retained[index].businessId === businessId && !protectedIds.has(retained[index].id)) {
      retained.splice(index, 1); count -= 1;
    }
  }
  return retained;
}

function mergeKnownBusinessPersistence(profiles, campaigns, businessId, serverRecord, preserveLocalProfile) {
  const serverProfile = serverRecord && serverRecord.businessProfile;
  if (!businessId || !serverProfile || serverProfile.businessId !== businessId) {
    throw new Error("The restored business did not match the requested business.");
  }
  const profileIndex = profiles.findIndex(function (profile) { return profile.businessId === businessId; });
  if (profileIndex < 0) throw new Error("Only a locally known business can be restored.");

  const nextProfiles = profiles.slice();
  if (!preserveLocalProfile) {
    nextProfiles[profileIndex] = { ...profiles[profileIndex], ...serverProfile, businessId };
  }
  const serverCampaigns = Array.isArray(serverRecord.campaigns) ? serverRecord.campaigns : [];
  const validServerCampaigns = serverCampaigns.filter(function (campaign) {
    return campaign && typeof campaign.id === "string" && campaign.businessId === businessId;
  });
  const serverById = new Map(validServerCampaigns.map(function (campaign) { return [campaign.id, campaign]; }));
  const mergedCampaigns = campaigns.map(function (campaign) {
    const restored = campaign && serverById.get(campaign.id);
    if (!restored) return campaign;
    serverById.delete(campaign.id);
    return { ...campaign, ...restored, id: restored.id, businessId };
  });
  validServerCampaigns.forEach(function (campaign) {
    if (serverById.has(campaign.id)) {
      mergedCampaigns.push({ ...campaign, id: campaign.id, businessId });
      serverById.delete(campaign.id);
    }
  });
  return { profiles: nextProfiles, campaigns: mergedCampaigns };
}

async function hydrateKnownBusiness(storage, businessId, fetchImpl) {
  const profiles = parseStoredJson(storage, "demeosBusinessProfiles", []);
  if (!Array.isArray(profiles) || !profiles.some(function (profile) { return profile.businessId === businessId; })) {
    return { hydrated: false, reason: "unknown-business" };
  }
  try {
    const response = await fetchImpl(`/api/businesses/${encodeURIComponent(businessId)}`);
    if (!response.ok) return { hydrated: false, reason: "server-error" };
    const serverRecord = await response.json();
    const currentProfiles = parseStoredJson(storage, "demeosBusinessProfiles", []);
    const currentCampaigns = parseStoredJson(storage, "demeosCampaignHistory", []);
    if (!Array.isArray(currentProfiles) || !currentProfiles.some(function (profile) { return profile.businessId === businessId; })) {
      return { hydrated: false, reason: "unknown-business" };
    }
    const merged = mergeKnownBusinessPersistence(
      currentProfiles,
      Array.isArray(currentCampaigns) ? currentCampaigns : [],
      businessId,
      serverRecord,
      readPendingBusinessProfileSyncIds(storage).includes(businessId)
    );
    storage.setItem("demeosBusinessProfiles", JSON.stringify(merged.profiles));
    storage.setItem("demeosCampaignHistory", JSON.stringify(merged.campaigns));
    return { hydrated: true, ...merged };
  } catch (error) {
    console.error("Could not restore known business:", error);
    return { hydrated: false, reason: "server-error" };
  }
}

function createCampaignPersistenceQueue(persistWrite) {
  const pendingByCampaignId = new Map();
  return function (profile, campaign) {
    const campaignId = campaign.id;
    const queuedProfile = { ...profile };
    const queuedCampaign = { ...campaign };
    const previous = pendingByCampaignId.get(campaignId) || Promise.resolve();
    const pending = previous.catch(function () {}).then(function () {
      return persistWrite(queuedProfile, queuedCampaign);
    });
    pendingByCampaignId.set(campaignId, pending);
    pending.then(function () {
      if (pendingByCampaignId.get(campaignId) === pending) pendingByCampaignId.delete(campaignId);
    }, function () {
      if (pendingByCampaignId.get(campaignId) === pending) pendingByCampaignId.delete(campaignId);
    });
    return pending;
  };
}

const fullCampaignSectionHeadings = [
  "CAMPAIGN STRATEGY",
  "SOCIAL MEDIA POST",
  "EMAIL CAMPAIGN",
  "SHORT AD COPY",
  "CALL TO ACTION"
];
const fullCampaignSectionLabels = [
  "Campaign Strategy", "Social Media Post", "Email Campaign", "Short Ad Copy", "Call to Action"
];
const fullCampaignRevisionTargets = [
  "campaign_strategy", "social_media_post", "email_campaign", "short_ad_copy", "call_to_action"
];

function parseFullCampaignSections(campaignText) {
  if (typeof campaignText !== "string") return null;
  const headingPattern = new RegExp(`^[\\t ]*(${fullCampaignSectionHeadings.join("|")})[\\t ]*\\r?$`, "gm");
  const matches = Array.from(campaignText.matchAll(headingPattern));
  if (matches.length !== fullCampaignSectionHeadings.length) return null;
  if (campaignText.slice(0, matches[0].index).trim()) return null;
  if (!matches.every(function (match, index) { return match[1] === fullCampaignSectionHeadings[index]; })) return null;

  const sections = matches.map(function (match, index) {
    const contentStart = match.index + match[0].length;
    const contentEnd = index + 1 < matches.length ? matches[index + 1].index : campaignText.length;
    return { heading: match[1], content: campaignText.slice(contentStart, contentEnd).trim() };
  });
  return sections.every(function (section) { return section.content; }) ? sections : null;
}

function getCampaignWorkspace(campaign) {
  const campaignText = campaign && typeof campaign.campaignText === "string" ? campaign.campaignText : "";
  const campaignType = campaign && campaign.campaignType;
  const isFullCampaign = campaignType === "full" || campaignType === "Full Marketing Campaign";
  return {
    campaignText,
    sections: isFullCampaign ? parseFullCampaignSections(campaignText) : null
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = {
  addBusinessIdentity, addPendingBusinessProfileSync, canAccessCampaign, createCampaignContinuity, enforceBusinessCampaignLimit,
  createCampaignPersistenceQueue,
  getCampaignBusinessId, getCampaignContinuity, getCampaignContinuityLabel, getCampaignVersions, getVisibleCampaigns,
  hydrateKnownBusiness, mergeKnownBusinessPersistence, migrateBusinessProfiles, readPendingBusinessProfileSyncIds,
  removePendingBusinessProfileSync, updateBusinessProfile, parseFullCampaignSections, getCampaignWorkspace
};

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  const byId = function (id) { return document.getElementById(id); };
  const generateBtn = byId("generate-btn");
  const promoInput = byId("promo-input");
  const campaignType = byId("campaign-type");
  const recommendationsBtn = byId("recommendations-btn");
  const recommendationsStatus = byId("recommendations-status");
  const recommendationsList = byId("recommendations-list");
  const businessSituation = byId("business-situation");
  const resultsArea = byId("results");
  const resultsContent = byId("results-content");
  const campaignVersions = byId("campaign-versions");
  const campaignVersionsList = byId("campaign-versions-list");
  const copyBtn = byId("copy-btn");
  const approveBtn = byId("approve-btn");
  const revisionControls = byId("campaign-revision-controls");
  const revisionInstruction = byId("revision-instruction");
  const revisionTargetIndicator = byId("revision-target-indicator");
  const reviseBtn = byId("revise-btn");
  const campaignApprovalStatus = byId("campaign-approval-status");
  const campaignHistoryList = byId("campaign-history-list");
  const campaignHistoryEmpty = byId("campaign-history-empty");
  const businessSelector = byId("business-selector");
  const addBusinessBtn = byId("add-business-btn");
  const saveBusinessProfileBtn = byId("save-business-profile-btn");
  const fields = {
    name: byId("business-name"), type: byId("business-type"), location: byId("business-location"),
    brandVoice: byId("business-brand-voice"), targetCustomer: byId("business-target-customer"), goal: byId("business-goal")
  };
  const campaignHistoryKey = "demeosCampaignHistory";
  let state = migrateBusinessProfiles(localStorage);
  let openCampaignId = null;
  let currentCampaignText = "";
  let addingBusiness = false;
  let selectedRevisionTarget = null;
  let recommendationBusinessId = null;

  function clearRecommendations() {
    recommendationBusinessId = null;
    recommendationsStatus.textContent = "";
    recommendationsList.textContent = "";
  }

  function clearBusinessSituation() {
    businessSituation.value = "";
  }

  function renderRecommendations(recommendations, businessId) {
    clearRecommendations();
    recommendationBusinessId = businessId;
    recommendations.forEach(function (recommendation) {
      const card = document.createElement("article"); card.className = "recommendation-card";
      const title = document.createElement("h3"); title.textContent = recommendation.title;
      function detail(labelText, value) {
        const section = document.createElement("div"); section.className = "recommendation-detail";
        const label = document.createElement("h4"); label.textContent = labelText;
        const content = document.createElement("p"); content.textContent = value;
        section.append(label, content); return section;
      }
      const reason = detail("Why this helps", recommendation.reason);
      const targetCustomer = detail("Target customer", recommendation.targetCustomer);
      const businessObjective = detail("Business objective", recommendation.businessObjective);
      const capability = detail("DEMEOS will create", recommendation.demeosCapability);
      const use = document.createElement("button"); use.type = "button"; use.className = "demeos-secondary-button";
      use.textContent = "Use This Recommendation";
      use.addEventListener("click", function () {
        if (recommendationBusinessId !== state.activeBusinessId || addingBusiness) return;
        promoInput.value = recommendation.suggestedRequest;
        campaignType.value = recommendation.suggestedCampaignType;
        if (typeof promoInput.focus === "function") promoInput.focus();
      });
      card.append(title, reason, targetCustomer, businessObjective, capability, use); recommendationsList.appendChild(card);
    });
  }

  function clearRevisionTarget() {
    selectedRevisionTarget = null;
    revisionTargetIndicator.textContent = "";
    revisionTargetIndicator.hidden = true;
  }

  function selectRevisionTarget(index) {
    selectedRevisionTarget = fullCampaignRevisionTargets[index];
    revisionTargetIndicator.textContent = `Revising: ${fullCampaignSectionLabels[index]}`;
    revisionTargetIndicator.hidden = false;
    if (typeof revisionInstruction.focus === "function") revisionInstruction.focus();
  }

  function copyText(text, button, defaultLabel) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      button.textContent = "Copied!";
      setTimeout(function () { button.textContent = defaultLabel; }, 1500);
    }).catch(function (error) { console.error("Could not copy campaign:", error); });
  }

  function renderCampaign(campaign) {
    const workspace = getCampaignWorkspace(campaign);
    currentCampaignText = workspace.campaignText;
    resultsContent.textContent = "";
    if (!workspace.sections) {
      resultsContent.textContent = workspace.campaignText;
      return;
    }
    workspace.sections.forEach(function (section, index) {
      const panel = document.createElement("section"); panel.className = "campaign-workspace-section";
      const header = document.createElement("div"); header.className = "campaign-workspace-section-header";
      const heading = document.createElement("h5"); heading.textContent = fullCampaignSectionLabels[index];
      const sectionCopy = document.createElement("button"); sectionCopy.type = "button";
      sectionCopy.className = "campaign-section-copy"; sectionCopy.textContent = "Copy";
      sectionCopy.setAttribute("aria-label", `Copy ${heading.textContent}`);
      sectionCopy.addEventListener("click", function () { copyText(section.content, sectionCopy, "Copy"); });
      const sectionRevise = document.createElement("button"); sectionRevise.type = "button";
      sectionRevise.className = "campaign-section-revise"; sectionRevise.textContent = "Revise";
      sectionRevise.setAttribute("aria-label", `Revise ${heading.textContent}`);
      sectionRevise.addEventListener("click", function () { selectRevisionTarget(index); });
      const content = document.createElement("div"); content.className = "campaign-workspace-section-content"; content.textContent = section.content;
      header.append(heading, sectionCopy, sectionRevise); panel.append(header, content); resultsContent.appendChild(panel);
    });
  }

  function renderCampaignVersions() {
    campaignVersionsList.textContent = "";
    const current = getCampaignHistory().find(function (entry) { return entry.id === openCampaignId; });
    const versions = getCampaignVersions(getCampaignHistory(), current, activeProfile());
    campaignVersions.hidden = versions.length === 0;
    versions.forEach(function (version) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "campaign-version-button";
      button.textContent = getCampaignContinuityLabel(version);
      if (version.id === openCampaignId) {
        button.className += " is-current";
        button.ariaCurrent = "true";
        if (typeof button.setAttribute === "function") button.setAttribute("aria-current", "true");
      }
      button.addEventListener("click", function () { openCampaign(version.id); });
      campaignVersionsList.appendChild(button);
    });
  }

  function openCampaign(campaignId) {
    const campaign = getCampaignHistory().find(function (entry) { return entry.id === campaignId; });
    if (!canAccessCampaign(campaign, activeProfile())) { alert("This campaign belongs to a different business profile."); return; }
    clearRevisionTarget(); revisionInstruction.value = ""; openCampaignId = campaign.id || null;
    renderCampaign(campaign); renderCampaignVersions(); showApprovalStatus(campaign.approvalStatus);
    resultsArea.hidden = false; copyBtn.hidden = false; revisionControls.hidden = false;
    resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function hydrateActiveBusiness() {
    const requestedBusinessId = state.activeBusinessId;
    if (!requestedBusinessId || typeof window === "undefined" || typeof fetch !== "function") return;
    const result = await hydrateKnownBusiness(localStorage, requestedBusinessId, fetch);
    if (!result.hydrated || state.activeBusinessId !== requestedBusinessId) return;
    state.profiles = result.profiles;
    fillProfile(activeProfile()); renderSelector(); renderCampaignHistory();
  }
  async function persistBusiness(profile) {
    if (!profile || typeof window === "undefined" || typeof fetch !== "function") return false;
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(profile.businessId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessProfile: profile })
      });
      return response.ok;
    } catch (error) {
      console.error("Could not persist business:", error); return false;
    }
  }
  async function persistCampaignWrite(profile, campaign) {
    if (!await persistBusiness(profile)) return false;
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(profile.businessId)}/campaigns/${encodeURIComponent(campaign.id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign })
      });
      if (!response.ok) console.error("Could not persist campaign: server returned", response.status);
      return Boolean(response.ok);
    } catch (error) { console.error("Could not persist campaign:", error); return false; }
  }
  const persistCampaign = createCampaignPersistenceQueue(persistCampaignWrite);

  function activeProfile() {
    return state.profiles.find(function (profile) { return profile.businessId === state.activeBusinessId; }) || null;
  }
  function getCampaignHistory() {
    const campaigns = parseStoredJson(localStorage, campaignHistoryKey, []);
    return Array.isArray(campaigns) ? campaigns : [];
  }
  function fillProfile(profile) {
    Object.keys(fields).forEach(function (key) { fields[key].value = (profile && profile[key]) || ""; });
  }
  function renderSelector() {
    businessSelector.textContent = "";
    state.profiles.forEach(function (profile) {
      const option = document.createElement("option");
      option.value = profile.businessId;
      option.textContent = profile.name || "Unnamed Business";
      businessSelector.appendChild(option);
    });
    businessSelector.value = state.activeBusinessId || "";
    businessSelector.disabled = state.profiles.length === 0;
  }
  function clearCampaignWorkspace() {
    clearRevisionTarget();
    openCampaignId = null;
    currentCampaignText = "";
    resultsContent.textContent = "";
    resultsArea.hidden = true;
    copyBtn.hidden = true;
    approveBtn.hidden = true;
    campaignApprovalStatus.hidden = true;
    revisionControls.hidden = true;
    revisionInstruction.value = "";
    campaignVersionsList.textContent = "";
    campaignVersions.hidden = true;
  }
  function showApprovalStatus(status) {
    const approved = status === "Approved";
    campaignApprovalStatus.textContent = approved ? "Status: Approved" : "Status: Unapproved";
    campaignApprovalStatus.classList.toggle("is-approved", approved);
    campaignApprovalStatus.hidden = false;
    approveBtn.hidden = approved;
  }
  function renderCampaignHistory() {
    const visible = getVisibleCampaigns(getCampaignHistory(), activeProfile());
    campaignHistoryList.textContent = "";
    campaignHistoryEmpty.hidden = visible.length > 0;
    visible.forEach(function (savedCampaign) {
      const item = document.createElement("article"); item.className = "campaign-history-item";
      const heading = document.createElement("h4"); heading.textContent = savedCampaign.businessName || "Business name unavailable";
      const details = document.createElement("p"); details.className = "campaign-history-details";
      details.textContent = `${savedCampaign.campaignTypeLabel || savedCampaign.campaignType || "Campaign"} · ${new Date(savedCampaign.createdAt).toLocaleString()}`;
      const continuity = document.createElement("span"); continuity.className = "campaign-history-continuity";
      continuity.textContent = getCampaignContinuityLabel(savedCampaign); details.prepend(continuity, " · ");
      const status = document.createElement("p"); status.className = `campaign-history-status ${savedCampaign.approvalStatus === "Approved" ? "is-approved" : ""}`;
      status.textContent = savedCampaign.approvalStatus === "Approved" ? "Approved" : "Unapproved";
      const preview = document.createElement("p"); preview.className = "campaign-history-preview"; preview.textContent = savedCampaign.campaignText || "";
      const open = document.createElement("button"); open.type = "button"; open.textContent = "Open";
      open.addEventListener("click", function () { openCampaign(savedCampaign.id); });
      item.append(heading, details, status, preview, open); campaignHistoryList.appendChild(item);
    });
  }
  function switchBusiness(businessId) {
    if (!state.profiles.some(function (profile) { return profile.businessId === businessId; })) return;
    state.activeBusinessId = businessId; addingBusiness = false;
    localStorage.setItem("demeosActiveBusinessId", businessId);
    clearRecommendations(); clearBusinessSituation(); fillProfile(activeProfile()); renderSelector(); clearCampaignWorkspace(); renderCampaignHistory();
    hydrateActiveBusiness();
  }
  async function saveCampaign(text, promo, type, typeLabel, profile, sourceId) {
    const campaigns = getCampaignHistory();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const source = sourceId ? campaigns.find(function (entry) { return entry.id === sourceId; }) : null;
    const continuity = createCampaignContinuity(id, source);
    const campaign = { id, campaignText: text, campaignType: type, campaignTypeLabel: typeLabel, promoText: promo,
      businessName: profile.name, businessId: getCampaignBusinessId(profile, source), createdAt: new Date().toISOString(),
      approvalStatus: "Unapproved", ...continuity };
    campaigns.unshift(campaign);
    const retained = enforceBusinessCampaignLimit(campaigns, profile.businessId, 20, [id, sourceId]);
    localStorage.setItem(campaignHistoryKey, JSON.stringify(retained)); openCampaignId = id; renderCampaignHistory(); renderCampaignVersions();
    const persisted = await persistCampaign(profile, campaign); return { id, persisted };
  }

  renderSelector(); fillProfile(activeProfile()); renderCampaignHistory(); hydrateActiveBusiness();
  businessSelector.addEventListener("change", function () { switchBusiness(businessSelector.value); });
  addBusinessBtn.addEventListener("click", function () {
    addingBusiness = true; businessSelector.value = ""; fillProfile(null); clearRecommendations(); clearBusinessSituation(); clearCampaignWorkspace();
  });
  saveBusinessProfileBtn.addEventListener("click", async function () {
    const profileFields = {};
    Object.keys(fields).forEach(function (key) { profileFields[key] = fields[key].value.trim(); });
    if (Object.keys(profileFields).some(function (key) { return !profileFields[key]; })) {
      alert("Please complete all Business Manager Profile fields before saving."); return;
    }

    saveBusinessProfileBtn.disabled = true;
    saveBusinessProfileBtn.textContent = "Saving Business Profile...";
    try {
      const result = updateBusinessProfile(state.profiles, profileFields, addingBusiness ? null : state.activeBusinessId);
      state = { profiles: result.profiles, activeBusinessId: result.profile.businessId }; addingBusiness = false;
      localStorage.setItem("demeosBusinessProfiles", JSON.stringify(state.profiles));
      localStorage.setItem("demeosActiveBusinessId", state.activeBusinessId);
      renderSelector(); fillProfile(result.profile); clearRecommendations(); clearCampaignWorkspace(); renderCampaignHistory();

      addPendingBusinessProfileSync(localStorage, result.profile.businessId);
      const persisted = await persistBusiness(result.profile);
      if (persisted) {
        removePendingBusinessProfileSync(localStorage, result.profile.businessId);
        alert("Business Profile saved successfully.");
      } else {
        alert("Business Profile saved on this device, but DEMEOS could not sync it to the server. Please try saving again.");
      }
    } finally {
      saveBusinessProfileBtn.disabled = false;
      saveBusinessProfileBtn.textContent = "Save Business Profile";
    }
  });

  async function requestCampaign(body) {
    const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const responseText = await response.text(); let data;
    try { data = responseText ? JSON.parse(responseText) : {}; }
    catch (error) { throw new Error(`DEMEOS received an unreadable server response (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(`${data.error || "DEMEOS could not generate your marketing work."}${data.details ? ` ${data.details}` : ""}${data.requestId ? ` Request ID: ${data.requestId}` : ""}`);
    if (typeof data.campaign !== "string" || !data.campaign.trim()) throw new Error("DEMEOS returned no marketing content.");
    return data.campaign;
  }

  recommendationsBtn.addEventListener("click", async function () {
    const profile = activeProfile();
    if (!profile || addingBusiness) { alert("Please complete and save your Business Manager Profile before requesting recommendations."); return; }
    const requestedBusinessId = profile.businessId;
    clearRecommendations(); recommendationsBtn.disabled = true;
    recommendationsStatus.textContent = "DEMEOS is reviewing your business...";
    try {
      const response = await fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessProfile: profile, businessSituation: businessSituation.value.trim() }) });
      const responseText = await response.text(); let data;
      try { data = responseText ? JSON.parse(responseText) : {}; } catch (error) { throw new Error("DEMEOS received an unreadable recommendation response."); }
      if (!response.ok) throw new Error(data.error || "DEMEOS could not create recommendations.");
      if (!Array.isArray(data.recommendations) || data.recommendations.length !== 3) throw new Error("DEMEOS returned invalid recommendations.");
      if (state.activeBusinessId === requestedBusinessId && !addingBusiness) renderRecommendations(data.recommendations, requestedBusinessId);
    } catch (error) {
      if (state.activeBusinessId === requestedBusinessId && !addingBusiness) recommendationsStatus.textContent = error.message;
    } finally { recommendationsBtn.disabled = false; }
  });

  generateBtn.addEventListener("click", async function () {
    const profile = activeProfile(); const promo = promoInput.value.trim();
    if (!profile) { alert("Please complete and save your Business Manager Profile before creating marketing work."); return; }
    if (!promo) { alert("Please tell DEMEOS what you would like to achieve first."); return; }
    generateBtn.disabled = true; generateBtn.textContent = "DEMEOS is working..."; resultsArea.hidden = false;
    currentCampaignText = ""; resultsContent.textContent = "DEMEOS is creating your marketing work..."; copyBtn.hidden = true; approveBtn.hidden = true;
    campaignApprovalStatus.hidden = true; revisionControls.hidden = true; openCampaignId = null; clearRevisionTarget();
    campaignVersionsList.textContent = ""; campaignVersions.hidden = true;
    try {
      const text = await requestCampaign({ promoText: promo, campaignType: campaignType.value, businessProfile: profile });
      renderCampaign({ campaignText: text, campaignType: campaignType.value }); copyBtn.hidden = false;
      const saved = await saveCampaign(text, promo, campaignType.value, campaignType.options[campaignType.selectedIndex].text, profile);
      showApprovalStatus("Unapproved"); revisionControls.hidden = false;
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!saved.persisted) alert("Campaign saved on this device, but DEMEOS could not sync it to the server. Please try again.");
    } catch (error) { console.error(error); resultsContent.textContent = error.message; }
    finally { generateBtn.disabled = false; generateBtn.textContent = "Create with DEMEOS"; }
  });

  reviseBtn.addEventListener("click", async function () {
    const campaigns = getCampaignHistory();
    const source = campaigns.find(function (entry) { return entry.id === openCampaignId; });
    if (!source) { alert("Please open a saved campaign before requesting a revision."); return; }
    const profile = activeProfile();
    if (!canAccessCampaign(source, profile)) { alert("This campaign belongs to a different business profile."); return; }
    const instruction = revisionInstruction.value.trim();
    if (!instruction) { alert("Please tell DEMEOS what you would like to change."); return; }
    if (!profile) { alert("Please complete and save your Business Manager Profile before revising marketing work."); return; }
    const type = source.campaignType === "Social Media Post" ? "social" : source.campaignType === "Email Campaign" ? "email" : source.campaignType === "Full Marketing Campaign" ? "full" : source.campaignType;
    const label = source.campaignTypeLabel || (type === "social" ? "Social Media Post" : type === "email" ? "Email Campaign" : "Full Marketing Campaign");
    reviseBtn.disabled = true; reviseBtn.textContent = "DEMEOS is revising...";
    try {
      const request = { existingCampaign: source.campaignText, revisionInstruction: instruction, campaignType: type, businessProfile: profile };
      if (selectedRevisionTarget) request.revisionTarget = selectedRevisionTarget;
      const text = await requestCampaign(request);
      const saved = await saveCampaign(text, source.promoText || "", type, label, profile, source.id);
      clearRevisionTarget(); renderCampaign({ campaignText: text, campaignType: type }); renderCampaignVersions(); revisionInstruction.value = ""; copyBtn.hidden = false; showApprovalStatus("Unapproved");
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!saved.persisted) alert("Campaign saved on this device, but DEMEOS could not sync it to the server. Please try again.");
    } catch (error) { console.error(error); alert(error.message); }
    finally { reviseBtn.disabled = false; reviseBtn.textContent = "Revise Campaign"; }
  });

  approveBtn.addEventListener("click", async function () {
    if (!openCampaignId) return;
    const campaigns = getCampaignHistory(); const campaign = campaigns.find(function (entry) { return entry.id === openCampaignId; });
    if (!campaign) return;
    if (!canAccessCampaign(campaign, activeProfile())) { alert("This campaign belongs to a different business profile."); return; }
    campaign.approvalStatus = "Approved"; localStorage.setItem(campaignHistoryKey, JSON.stringify(campaigns));
    renderCampaignHistory(); approveBtn.disabled = true; approveBtn.textContent = "Saving Approval...";
    try {
      const persisted = await persistCampaign(activeProfile(), campaign);
      showApprovalStatus("Approved");
      if (!persisted) {
        approveBtn.hidden = false;
        alert("Approval saved on this device, but DEMEOS could not sync it to the server. Please try again.");
      }
    } finally { approveBtn.disabled = false; approveBtn.textContent = "Approve Campaign"; }
  });
  copyBtn.addEventListener("click", async function () {
    copyText(currentCampaignText, copyBtn, "Copy Campaign");
  });
});
