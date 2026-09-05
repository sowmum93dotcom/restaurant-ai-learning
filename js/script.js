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

if (typeof module !== "undefined" && module.exports) module.exports = {
  addBusinessIdentity, canAccessCampaign, createCampaignContinuity, enforceBusinessCampaignLimit,
  getCampaignBusinessId, getCampaignContinuity, getCampaignContinuityLabel, getVisibleCampaigns,
  migrateBusinessProfiles, updateBusinessProfile
};

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  const byId = function (id) { return document.getElementById(id); };
  const generateBtn = byId("generate-btn");
  const promoInput = byId("promo-input");
  const campaignType = byId("campaign-type");
  const resultsArea = byId("results");
  const resultsContent = byId("results-content");
  const copyBtn = byId("copy-btn");
  const approveBtn = byId("approve-btn");
  const revisionControls = byId("campaign-revision-controls");
  const revisionInstruction = byId("revision-instruction");
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
  let addingBusiness = false;

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
    openCampaignId = null;
    resultsContent.textContent = "";
    resultsArea.hidden = true;
    copyBtn.hidden = true;
    approveBtn.hidden = true;
    campaignApprovalStatus.hidden = true;
    revisionControls.hidden = true;
    revisionInstruction.value = "";
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
      open.addEventListener("click", function () {
        const campaign = getCampaignHistory().find(function (entry) { return entry.id === savedCampaign.id; });
        if (!canAccessCampaign(campaign, activeProfile())) { alert("This campaign belongs to a different business profile."); return; }
        resultsContent.textContent = campaign.campaignText; openCampaignId = campaign.id || null;
        showApprovalStatus(campaign.approvalStatus); resultsArea.hidden = false; copyBtn.hidden = false;
        revisionControls.hidden = false; revisionInstruction.value = "";
        resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      item.append(heading, details, status, preview, open); campaignHistoryList.appendChild(item);
    });
  }
  function switchBusiness(businessId) {
    if (!state.profiles.some(function (profile) { return profile.businessId === businessId; })) return;
    state.activeBusinessId = businessId; addingBusiness = false;
    localStorage.setItem("demeosActiveBusinessId", businessId);
    fillProfile(activeProfile()); renderSelector(); clearCampaignWorkspace(); renderCampaignHistory();
  }
  function saveCampaign(text, promo, type, typeLabel, profile, sourceId) {
    const campaigns = getCampaignHistory();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const source = sourceId ? campaigns.find(function (entry) { return entry.id === sourceId; }) : null;
    const continuity = createCampaignContinuity(id, source);
    campaigns.unshift({ id, campaignText: text, campaignType: type, campaignTypeLabel: typeLabel, promoText: promo,
      businessName: profile.name, businessId: getCampaignBusinessId(profile, source), createdAt: new Date().toISOString(),
      approvalStatus: "Unapproved", ...continuity });
    const retained = enforceBusinessCampaignLimit(campaigns, profile.businessId, 20, [id, sourceId]);
    localStorage.setItem(campaignHistoryKey, JSON.stringify(retained)); openCampaignId = id; renderCampaignHistory(); return id;
  }

  renderSelector(); fillProfile(activeProfile()); renderCampaignHistory();
  businessSelector.addEventListener("change", function () { switchBusiness(businessSelector.value); });
  addBusinessBtn.addEventListener("click", function () {
    addingBusiness = true; businessSelector.value = ""; fillProfile(null); clearCampaignWorkspace();
  });
  saveBusinessProfileBtn.addEventListener("click", function () {
    const profileFields = {};
    Object.keys(fields).forEach(function (key) { profileFields[key] = fields[key].value.trim(); });
    if (Object.keys(profileFields).some(function (key) { return !profileFields[key]; })) {
      alert("Please complete all Business Manager Profile fields before saving."); return;
    }
    const result = updateBusinessProfile(state.profiles, profileFields, addingBusiness ? null : state.activeBusinessId);
    state = { profiles: result.profiles, activeBusinessId: result.profile.businessId }; addingBusiness = false;
    localStorage.setItem("demeosBusinessProfiles", JSON.stringify(state.profiles));
    localStorage.setItem("demeosActiveBusinessId", state.activeBusinessId);
    renderSelector(); fillProfile(result.profile); clearCampaignWorkspace(); renderCampaignHistory();
    alert("Business Profile saved successfully.");
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

  generateBtn.addEventListener("click", async function () {
    const profile = activeProfile(); const promo = promoInput.value.trim();
    if (!profile) { alert("Please complete and save your Business Manager Profile before creating marketing work."); return; }
    if (!promo) { alert("Please tell DEMEOS what you would like to achieve first."); return; }
    generateBtn.disabled = true; generateBtn.textContent = "DEMEOS is working..."; resultsArea.hidden = false;
    resultsContent.textContent = "DEMEOS is creating your marketing work..."; copyBtn.hidden = true; approveBtn.hidden = true;
    campaignApprovalStatus.hidden = true; revisionControls.hidden = true; openCampaignId = null;
    try {
      const text = await requestCampaign({ promoText: promo, campaignType: campaignType.value, businessProfile: profile });
      resultsContent.textContent = text; copyBtn.hidden = false;
      saveCampaign(text, promo, campaignType.value, campaignType.options[campaignType.selectedIndex].text, profile);
      showApprovalStatus("Unapproved"); revisionControls.hidden = false;
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
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
      const text = await requestCampaign({ existingCampaign: source.campaignText, revisionInstruction: instruction, campaignType: type, businessProfile: profile });
      saveCampaign(text, source.promoText || "", type, label, profile, source.id);
      resultsContent.textContent = text; revisionInstruction.value = ""; copyBtn.hidden = false; showApprovalStatus("Unapproved");
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { console.error(error); alert(error.message); }
    finally { reviseBtn.disabled = false; reviseBtn.textContent = "Revise Campaign"; }
  });

  approveBtn.addEventListener("click", function () {
    if (!openCampaignId) return;
    const campaigns = getCampaignHistory(); const campaign = campaigns.find(function (entry) { return entry.id === openCampaignId; });
    if (!campaign) return;
    if (!canAccessCampaign(campaign, activeProfile())) { alert("This campaign belongs to a different business profile."); return; }
    campaign.approvalStatus = "Approved"; localStorage.setItem(campaignHistoryKey, JSON.stringify(campaigns));
    showApprovalStatus("Approved"); renderCampaignHistory();
  });
  copyBtn.addEventListener("click", async function () {
    const text = resultsContent.textContent.trim(); if (!text) return;
    try { await navigator.clipboard.writeText(text); copyBtn.textContent = "Copied!"; setTimeout(function () { copyBtn.textContent = "Copy Campaign"; }, 1500); }
    catch (error) { console.error("Could not copy campaign:", error); }
  });
});
