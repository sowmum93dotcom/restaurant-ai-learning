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

function applyAuthorizedBusinessProfiles(cachedProfiles, serverBusinesses, selectedBusinessId) {
  const cachedById = new Map((Array.isArray(cachedProfiles) ? cachedProfiles : []).filter(function (profile) {
    return profile && typeof profile.businessId === "string";
  }).map(function (profile) { return [profile.businessId, profile]; }));
  const profiles = (Array.isArray(serverBusinesses) ? serverBusinesses : []).filter(function (profile) {
    return profile && typeof profile.businessId === "string" && profile.businessId;
  }).map(function (profile) {
    return { ...(cachedById.get(profile.businessId) || {}), ...profile, businessId: profile.businessId };
  });
  const activeBusinessId = profiles.some(function (profile) { return profile.businessId === selectedBusinessId; })
    ? selectedBusinessId : (profiles[0] ? profiles[0].businessId : null);
  return { profiles, activeBusinessId };
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
function getCampaignOutcomes(campaigns, businessId) {
  const allowedOutcomes = new Set(["Positive", "Mixed", "No noticeable result", "Not used yet"]);
  return campaigns.filter(function (campaign) {
    return campaign && campaign.businessId === businessId && campaign.outcome &&
      allowedOutcomes.has(campaign.outcome.outcome);
  }).slice(0, 10).map(function (campaign) {
    const context = {
      campaignType: campaign.campaignType,
      outcome: campaign.outcome.outcome,
      ownerNote: typeof campaign.outcome.ownerNote === "string" ? campaign.outcome.ownerNote : ""
    };
    if (typeof campaign.promoText === "string" && campaign.promoText.trim()) {
      context.marketingRequest = campaign.promoText;
    }
    return context;
  });
}
function getRecommendationDecisionContext(decisions, businessId) {
  const allowedDecisions = new Set(["used", "modified", "rejected"]);
  const allowedCampaignTypes = new Set(["full", "social", "email"]);
  if (!businessId || !Array.isArray(decisions)) return [];
  return decisions.filter(function (item) {
    return item && item.businessId === businessId && typeof item.recommendationTitle === "string" &&
      allowedCampaignTypes.has(item.suggestedCampaignType) && allowedDecisions.has(item.decision) &&
      typeof item.timestamp === "string";
  }).sort(function (left, right) {
    return right.timestamp.localeCompare(left.timestamp);
  }).slice(0, 20).map(function (item) {
    return { recommendationTitle: item.recommendationTitle, suggestedCampaignType: item.suggestedCampaignType,
      decision: item.decision, timestamp: item.timestamp };
  });
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
function getActiveMarketingWork(campaigns, businessId) {
  if (!businessId) return [];
  const latestByChain = new Map();
  campaigns.forEach(function (campaign) {
    if (!campaign || campaign.businessId !== businessId) return;
    const continuity = getCampaignContinuity(campaign);
    const current = latestByChain.get(continuity.originalMarketingWorkId);
    if (!current) {
      latestByChain.set(continuity.originalMarketingWorkId, campaign);
      return;
    }
    const currentContinuity = getCampaignContinuity(current);
    if (continuity.revisionNumber > currentContinuity.revisionNumber ||
      (continuity.revisionNumber === currentContinuity.revisionNumber &&
        String(campaign.createdAt || "") > String(current.createdAt || ""))) {
      latestByChain.set(continuity.originalMarketingWorkId, campaign);
    }
  });
  return Array.from(latestByChain.values()).map(function (campaign) {
    const approved = campaign.approvalStatus === "Approved";
    const hasOutcome = approved && Boolean(campaign.outcome);
    return {
      campaign,
      status: !approved ? "Draft — needs approval" : hasOutcome ? "Outcome recorded" : "Approved — outcome needed",
      action: !approved ? "Review Campaign" : hasOutcome ? "View Campaign" : "Record Outcome"
    };
  });
}
function getCustomerParticipationResults(results, businessId) {
  if (!businessId || !Array.isArray(results)) return [];
  return results.filter(function (result) {
    return result && result.businessId === businessId && typeof result.workItemId === "string" &&
      typeof result.name === "string" && Number.isInteger(result.customerInterestCount) &&
      result.customerInterestCount >= 0 && (result.latestParticipationAt === null ||
        typeof result.latestParticipationAt === "string");
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

function mergeKnownBusinessPersistence(profiles, campaigns, businessId, serverRecord, preserveLocalProfile, decisions) {
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
  const otherBusinessDecisions = (Array.isArray(decisions) ? decisions : []).filter(function (item) {
    return item && item.businessId !== businessId;
  });
  const restoredDecisions = (Array.isArray(serverRecord.recommendationDecisions) ? serverRecord.recommendationDecisions : [])
    .filter(function (item) { return item && item.businessId === businessId; });
  const customerParticipationResults = getCustomerParticipationResults(
    serverRecord.customerParticipationResults, businessId);
  return { profiles: nextProfiles, campaigns: mergedCampaigns,
    recommendationDecisions: otherBusinessDecisions.concat(restoredDecisions), customerParticipationResults };
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
    const currentDecisions = parseStoredJson(storage, "demeosRecommendationDecisions", []);
    if (!Array.isArray(currentProfiles) || !currentProfiles.some(function (profile) { return profile.businessId === businessId; })) {
      return { hydrated: false, reason: "unknown-business" };
    }
    const merged = mergeKnownBusinessPersistence(
      currentProfiles,
      Array.isArray(currentCampaigns) ? currentCampaigns : [],
      businessId,
      serverRecord,
      readPendingBusinessProfileSyncIds(storage).includes(businessId), currentDecisions
    );
    storage.setItem("demeosBusinessProfiles", JSON.stringify(merged.profiles));
    storage.setItem("demeosCampaignHistory", JSON.stringify(merged.campaigns));
    storage.setItem("demeosRecommendationDecisions", JSON.stringify(merged.recommendationDecisions));
    return { hydrated: true, ...merged, record: serverRecord };
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
  getActiveMarketingWork, getCustomerParticipationResults, getCampaignBusinessId, getCampaignContinuity, getCampaignContinuityLabel, getCampaignVersions, getVisibleCampaigns,
  hydrateKnownBusiness, mergeKnownBusinessPersistence, migrateBusinessProfiles, readPendingBusinessProfileSyncIds,
  removePendingBusinessProfileSync, updateBusinessProfile, parseFullCampaignSections, getCampaignWorkspace,
  applyAuthorizedBusinessProfiles
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
  const campaignOutcome = byId("campaign-outcome");
  const campaignOutcomeValue = byId("campaign-outcome-value");
  const campaignOutcomeNote = byId("campaign-outcome-note");
  const saveCampaignOutcomeBtn = byId("save-campaign-outcome");
  const campaignHistoryList = byId("campaign-history-list");
  const campaignHistoryEmpty = byId("campaign-history-empty");
  const activeMarketingWorkList = byId("active-marketing-work-list");
  const activeMarketingWorkEmpty = byId("active-marketing-work-empty");
  const recommendationDecisionsResultsList = byId("recommendation-decisions-results-list");
  const recommendationDecisionsResultsEmpty = byId("recommendation-decisions-results-empty");
  const customerParticipationResultsList = byId("customer-participation-results-list");
  const customerParticipationResultsEmpty = byId("customer-participation-results-empty");
  const businessSelector = byId("business-selector");
  const addBusinessBtn = byId("add-business-btn");
  const saveBusinessProfileBtn = byId("save-business-profile-btn");
  const fields = {
    name: byId("business-name"), type: byId("business-type"), location: byId("business-location"),
    productsServices: byId("business-products-services"),
    brandVoice: byId("business-brand-voice"), targetCustomer: byId("business-target-customer"), goal: byId("business-goal")
  };
  const continuationRouteIds = {
    website: "business-route-website", phone: "business-route-phone", whatsapp: "business-route-whatsapp",
    email: "business-route-email", visit: "business-route-visit", booking: "business-route-booking", quote: "business-route-quote"
  };
  const fulfilmentIds = {
    collection: "business-fulfilment-collection", delivery: "business-fulfilment-delivery",
    shipping: "business-fulfilment-shipping", premises: "business-fulfilment-premises",
    "customer-location": "business-fulfilment-customer-location", appointment: "business-fulfilment-appointment",
    digital: "business-fulfilment-digital"
  };
  const continuationDetails = {
    website: byId("business-website"), phone: byId("business-phone"), whatsapp: byId("business-whatsapp"),
    email: byId("business-email"), bookingLink: byId("business-booking-link"), visitAddress: byId("business-visit-address")
  };
  const continuationDetailContainers = {
    website: byId("business-website").parentElement,
    phone: byId("business-phone").parentElement,
    whatsapp: byId("business-whatsapp").parentElement,
    email: byId("business-email").parentElement,
    booking: byId("business-booking-link").parentElement,
    visit: byId("business-visit-address").parentElement
  };
  const fulfilmentNotes = byId("business-fulfilment-notes");
  const availabilityStatus = byId("business-availability-status");
  const businessHoursNotes = byId("business-hours-notes");
  const availabilityNotes = byId("business-availability-notes");
  const accuracyConfirmation = byId("business-accuracy-confirmation");
  const businessProfileStatus = byId("business-profile-status");
  const campaignHistoryKey = "demeosCampaignHistory";
  const recommendationDecisionsKey = "demeosRecommendationDecisions";
  const cachedBusinessState = migrateBusinessProfiles(localStorage);
  const serverAuthorizationRequired = typeof window !== "undefined" && window.document === document;
  let state = serverAuthorizationRequired ? { profiles: [], activeBusinessId: null } : cachedBusinessState;
  let openCampaignId = null;
  let currentCampaignText = "";
  let addingBusiness = false;
  let selectedRevisionTarget = null;
  let recommendationBusinessId = null;
  let selectedRecommendationDecision = null;
  let customerParticipationResults = [];

  function renderRecommendsUnderstanding(record, businessId) {
    const stateElement = byId("recommends-understanding-state");
    const learningList = byId("understanding-learning-history-list");
    const learningEmpty = byId("understanding-learning-history-empty");
    if (!stateElement) return;
    if (learningList) learningList.textContent = "";
    if (!record) {
      stateElement.textContent = "Understanding evidence is unavailable";
      byId("recommends-understanding-profile").textContent = "Availability unavailable";
      ["outcomes", "interest", "participation-campaigns", "feedback-relevant", "feedback-not-quite", "feedback-something-different", "used", "modified", "rejected"].forEach(function (key) {
        byId(`recommends-understanding-${key}`).textContent = "—";
      });
      if (learningEmpty) learningEmpty.hidden = false;
      return;
    }
    const understanding = DemeosUnderstanding.getDemeosUnderstanding(record, businessId);
    stateElement.textContent = understanding.evidenceAvailable
      ? "Current profile context with evidence recorded previously" : "No historical evidence recorded; absence is not failure";
    byId("recommends-understanding-profile").textContent = understanding.verifiedBusinessProfile
      ? "Complete verified Business Manager Profile available"
      : "Complete verified Business Manager Profile not available";
    byId("recommends-understanding-outcomes").textContent = understanding.campaignOutcomeCount;
    byId("recommends-understanding-interest").textContent = understanding.customerInterestCount;
    byId("recommends-understanding-participation-campaigns").textContent = understanding.campaignsWithCustomerParticipation;
    byId("recommends-understanding-feedback-relevant").textContent = understanding.customerFeedback.relevant;
    byId("recommends-understanding-feedback-not-quite").textContent = understanding.customerFeedback.notQuite;
    byId("recommends-understanding-feedback-something-different").textContent = understanding.customerFeedback.somethingDifferent;
    byId("recommends-understanding-used").textContent = understanding.recommendationDecisions.used;
    byId("recommends-understanding-modified").textContent = understanding.recommendationDecisions.modified;
    byId("recommends-understanding-rejected").textContent = understanding.recommendationDecisions.rejected;
    if (learningEmpty) learningEmpty.hidden = understanding.trustedLearningHistory.length > 0;
    understanding.trustedLearningHistory.forEach(function (learning) {
      if (!learningList) return;
      const item = document.createElement("article");
      item.className = "compact-list-item understanding-learning-record";
      addText(item, "strong", learning.recommendation);
      const decisionLabels = { used: "Used", modified: "Modified", rejected: "Not for me" };
      const decisionTime = learning.decision.recordedAt
        ? ` on ${new Date(learning.decision.recordedAt).toLocaleString()}` : " (recorded time unavailable)";
      addText(item, "span", `Owner decision: ${decisionLabels[learning.decision.value]}${decisionTime}. Source: business owner.`);
      if (learning.relatedWork.created) {
        const workTime = learning.relatedWork.recordedAt
          ? ` on ${new Date(learning.relatedWork.recordedAt).toLocaleString()}` : " (recorded time unavailable)";
        addText(item, "span", `Related work was created${workTime}. Source: DEMEOS campaign record.`);
      } else {
        addText(item, "span", "No related work is recorded for this previous decision.");
      }
      if (learning.customerParticipation) {
        addText(item, "span", `Historical Interested: ${learning.customerParticipation.interestedCount}. Customer participation only; not current demand.`);
      } else if (learning.relatedWork.created) {
        addText(item, "span", "No Interested evidence is recorded for this work; absence is not failure.");
      }
      if (learning.customerFeedback) {
        addText(item, "span", `Historical Customer Feedback — Relevant: ${learning.customerFeedback.relevant}; Not quite: ${learning.customerFeedback.notQuite}; Something different: ${learning.customerFeedback.somethingDifferent}. Not current customer opinion.`);
      } else if (learning.relatedWork.created) {
        addText(item, "span", "No Customer Feedback is recorded for this work; absence is not a negative opinion.");
      }
      if (learning.outcome) {
        const outcomeTime = learning.outcome.recordedAt
          ? ` on ${new Date(learning.outcome.recordedAt).toLocaleString()}` : " (recorded time unavailable)";
        addText(item, "span", `Later owner-recorded outcome: ${learning.outcome.value}${outcomeTime}. Source: business owner. This is historical evidence, not current demand.`);
      } else {
        addText(item, "span", "There is no owner-recorded outcome for this previous decision; absence is not failure.");
      }
      learningList.appendChild(item);
    });
  }

  function showWorkspaceView(viewId) {
    if (typeof document.querySelectorAll !== "function") return;
    document.querySelectorAll("[data-workspace-panel]").forEach(function (panel) {
      const active = panel.id === viewId;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    document.querySelectorAll("[data-workspace-view]").forEach(function (button) {
      const active = button.getAttribute("data-workspace-view") === viewId;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const navigation = byId("workspace-navigation");
    const menuToggle = byId("workspace-menu-toggle");
    if (navigation) navigation.classList.remove("is-open");
    if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
    if (typeof updateOwnerNavigation === "function") updateOwnerNavigation(document, window.location, viewId);
  }

  if (typeof document.querySelectorAll === "function") {
    document.querySelectorAll("[data-workspace-view]").forEach(function (button) {
      button.addEventListener("click", function () { showWorkspaceView(button.getAttribute("data-workspace-view")); });
    });
    document.querySelectorAll("[data-open-view]").forEach(function (button) {
      button.addEventListener("click", function () { showWorkspaceView(button.getAttribute("data-open-view")); });
    });
    document.querySelectorAll("[data-quick-create]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectedRecommendationDecision = null;
        campaignType.value = button.getAttribute("data-quick-create");
        showWorkspaceView("create");
        if (typeof promoInput.focus === "function") promoInput.focus();
      });
    });
    const menuToggle = byId("workspace-menu-toggle");
    const navigation = byId("workspace-navigation");
    if (menuToggle && navigation) menuToggle.addEventListener("click", function () {
      const open = menuToggle.getAttribute("aria-expanded") !== "true";
      menuToggle.setAttribute("aria-expanded", String(open));
      navigation.classList.toggle("is-open", open);
    });
    const requestedView = window.location.hash.slice(1);
    if (document.getElementById(requestedView) &&
        document.getElementById(requestedView).hasAttribute("data-workspace-panel")) {
      showWorkspaceView(requestedView);
    }
    window.addEventListener("hashchange", function () {
      const hashView = window.location.hash.slice(1);
      const panel = document.getElementById(hashView);
      if (panel && panel.hasAttribute("data-workspace-panel")) showWorkspaceView(hashView);
    });
  }

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
    const overviewRecommendation = byId("overview-recommendation");
    if (overviewRecommendation && recommendations[0]) {
      overviewRecommendation.textContent = "";
      const title = document.createElement("strong"); title.textContent = recommendations[0].title;
      const reason = document.createElement("p"); reason.textContent = recommendations[0].reason;
      overviewRecommendation.append(title, reason);
    }
    recommendations.forEach(function (recommendation) {
      const card = document.createElement("article"); card.className = "recommendation-card";
      const title = document.createElement("h3"); title.textContent = recommendation.title;
      function detail(labelText, value) {
        const section = document.createElement("div"); section.className = "recommendation-detail";
        const label = document.createElement("h4"); label.textContent = labelText;
        const content = document.createElement("p"); content.textContent = value;
        section.append(label, content); return section;
      }
      const why = detail("Why this recommendation", recommendation.whyThisRecommendation);
      const reason = detail("Why this helps", recommendation.reason);
      const targetCustomer = detail("Target customer", recommendation.targetCustomer);
      const businessObjective = detail("Business objective", recommendation.businessObjective);
      const capability = detail("DEMEOS will create", recommendation.demeosCapability);
      const evidenceLabels = {
        businessProfile: "Verified Business Profile",
        businessSituation: "Owner-provided Business Situation",
        campaignOutcome: "Owner-provided Campaign Result",
        recommendationDecision: "Owner Preference"
      };
      const fieldLabels = { name: "Business name", type: "Business type", location: "Location", brandVoice: "Brand voice",
        targetCustomer: "Target customer", goal: "Primary marketing goal", businessSituation: "Business situation",
        campaignType: "Campaign type", marketingRequest: "Marketing request", outcome: "Campaign outcome",
        ownerNote: "Owner note", recommendationTitle: "Recommendation", suggestedCampaignType: "Campaign type",
        decision: "Owner decision", timestamp: "Decision date" };
      const evidence = detail("Evidence", recommendation.evidence.map(function (item) {
        return `${fieldLabels[item.field] || item.field} — ${item.value} — ${evidenceLabels[item.source] || item.source}`;
      }).join("\n"));
      const expectedOutcome = detail("Expected outcome", recommendation.expectedOutcome);
      const requiredInput = detail("Required information", recommendation.requiredInput.length
        ? recommendation.requiredInput.join("\n") : "None");
      const approval = detail("Approval", recommendation.approvalState === "pending" ? "Pending" : recommendation.approvalState);
      const decisionStatus = document.createElement("p"); decisionStatus.className = "recommendation-decision";
      decisionStatus.setAttribute("aria-live", "polite");
      async function recordDecision(decision) {
        try {
          const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/recommendation-decisions`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recommendationTitle: recommendation.title,
              recommendationId: recommendation.recommendationId,
              suggestedCampaignType: recommendation.suggestedCampaignType,
              decision
            })
          });
          if (!response.ok) throw new Error(`server returned ${response.status}`);
          const data = typeof response.json === "function" ? await response.json() : {};
          const decisions = parseStoredJson(localStorage, recommendationDecisionsKey, []);
          const savedDecision = data.recommendationDecision;
          if (!savedDecision || !savedDecision.decisionId) throw new Error("server returned no decision provenance");
          decisions.push(savedDecision);
          localStorage.setItem(recommendationDecisionsKey, JSON.stringify(decisions));
          renderRecommendationDecisionResults();
          return savedDecision;
        } catch (error) {
          console.error("Could not persist recommendation decision:", error);
        }
      }
      const use = document.createElement("button"); use.type = "button"; use.className = "demeos-secondary-button";
      use.textContent = "Use This Recommendation";
      use.addEventListener("click", async function () {
        if (recommendationBusinessId !== state.activeBusinessId || addingBusiness) return;
        const savedDecision = await recordDecision("used");
        if (!savedDecision) { decisionStatus.textContent = "Could not record your decision. Please try again."; return; }
        promoInput.value = recommendation.suggestedRequest;
        campaignType.value = recommendation.suggestedCampaignType;
        showWorkspaceView("create");
        if (typeof promoInput.focus === "function") promoInput.focus();
        selectedRecommendationDecision = Promise.resolve(savedDecision);
        return selectedRecommendationDecision;
      });
      const modify = document.createElement("button"); modify.type = "button"; modify.className = "demeos-secondary-button";
      modify.textContent = "Modify";
      modify.addEventListener("click", async function () {
        if (recommendationBusinessId !== state.activeBusinessId || addingBusiness) return;
        const savedDecision = await recordDecision("modified");
        if (!savedDecision) { decisionStatus.textContent = "Could not record your decision. Please try again."; return; }
        promoInput.value = recommendation.suggestedRequest;
        campaignType.value = recommendation.suggestedCampaignType;
        showWorkspaceView("create");
        if (typeof promoInput.focus === "function") promoInput.focus();
        selectedRecommendationDecision = Promise.resolve(savedDecision);
        return selectedRecommendationDecision;
      });
      const reject = document.createElement("button"); reject.type = "button"; reject.className = "demeos-secondary-button";
      reject.textContent = "Not for me";
      reject.addEventListener("click", async function () {
        if (recommendationBusinessId !== state.activeBusinessId || addingBusiness) return;
        const savedDecision = await recordDecision("rejected");
        if (!savedDecision) { decisionStatus.textContent = "Could not record your decision. Please try again."; return; }
        card.classList.toggle("is-rejected", true);
        decisionStatus.textContent = "Not for me";
        return savedDecision;
      });
      card.append(title, why, reason, targetCustomer, businessObjective, capability, evidence, expectedOutcome, requiredInput,
        approval, use, modify, reject, decisionStatus);
      recommendationsList.appendChild(card);
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
    renderCampaign(campaign); renderCampaignVersions(); showApprovalStatus(campaign.approvalStatus); renderCampaignOutcome(campaign);
    resultsArea.hidden = false; copyBtn.hidden = false; revisionControls.hidden = false;
    resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function hydrateActiveBusiness() {
    const requestedBusinessId = state.activeBusinessId;
    if (!requestedBusinessId || typeof window === "undefined" || typeof fetch !== "function") return;
    const result = await hydrateKnownBusiness(localStorage, requestedBusinessId, fetch);
    if (!result.hydrated || state.activeBusinessId !== requestedBusinessId) {
      if (state.activeBusinessId === requestedBusinessId) renderRecommendsUnderstanding(null, requestedBusinessId);
      return;
    }
    state.profiles = result.profiles;
    customerParticipationResults = getCustomerParticipationResults(result.customerParticipationResults, requestedBusinessId);
    renderRecommendsUnderstanding(result.record, requestedBusinessId);
    fillProfile(activeProfile()); renderSelector(); renderActiveMarketingWork(); renderCustomerParticipationResults(); renderCampaignHistory();
  }
  async function persistBusiness(profile, options) {
    if (!profile || typeof window === "undefined" || typeof fetch !== "function") return false;
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(profile.businessId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessProfile: profile, ownerAccuracyConfirmed: Boolean(options && options.ownerAccuracyConfirmed) })
      });
      return response.ok;
    } catch (error) {
      console.error("Could not persist business:", error); return false;
    }
  }
  async function persistCampaignWrite(profile, campaign) {
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
  function selectedValues(idMap) {
    return Object.keys(idMap).filter(function (key) {
      const element = byId(idMap[key]);
      return element && element.checked;
    });
  }
  function setSelectedValues(idMap, values) {
    const selected = new Set(Array.isArray(values) ? values : []);
    Object.keys(idMap).forEach(function (key) {
      const element = byId(idMap[key]);
      if (element) element.checked = selected.has(key);
    });
  }
  function updateContinuationDetailVisibility() {
    Object.keys(continuationRouteIds).forEach(function (route) {
      const checkbox = byId(continuationRouteIds[route]);
      const detail = continuationDetailContainers[route];
      if (!detail) return;
      const visible = Boolean(checkbox && checkbox.checked);
      detail.hidden = !visible;
      const input = detail.querySelector("input") || detail.querySelector("textarea");
      if (input) input.disabled = !visible;
    });
  }
  function getContinuationDetails() {
    return {
      website: continuationDetails.website.value.trim(),
      phone: continuationDetails.phone.value.trim(),
      whatsapp: continuationDetails.whatsapp.value.trim(),
      email: continuationDetails.email.value.trim(),
      bookingLink: continuationDetails.bookingLink.value.trim(),
      visitAddress: continuationDetails.visitAddress.value.trim()
    };
  }
  const productFields = {
    id: byId("business-product-id"), name: byId("business-product-name"), price: byId("business-product-price"), priceMode: byId("business-product-price-mode"),
    description: byId("business-product-description"), image: byId("business-product-image"),
    route: byId("business-product-route"), availability: byId("business-product-availability"), visibility: byId("business-product-visibility"),
    fulfilmentMode: byId("business-product-fulfilment-mode")
  };
  const productAddBtn = byId("business-product-add-btn");
  const productCancelBtn = byId("business-product-cancel-btn");
  const productsList = byId("business-products-list");
  const productsEmpty = byId("business-products-empty");
  const productPriceValueWrap = byId("business-product-price-value-wrap");
  const productFulfilmentOptions = byId("business-product-fulfilment-options");
  const productImagePreview = byId("business-product-image-preview");
  const productImagePreviewImg = byId("business-product-image-preview-img");
  const productsTotal = byId("business-products-total");
  const productsVisible = byId("business-products-visible");
  const productsImages = byId("business-products-images");
  let draftProducts = [];

  function selectedProductFulfilment() {
    return productFulfilmentOptions && typeof productFulfilmentOptions.querySelectorAll === "function" ? Array.from(productFulfilmentOptions.querySelectorAll("input[type=checkbox]")).filter(function (input) { return input.checked; }).map(function (input) { return input.value; }) : [];
  }
  function setProductFulfilment(values) {
    const selected = new Set(Array.isArray(values) ? values : []);
    if (productFulfilmentOptions && typeof productFulfilmentOptions.querySelectorAll === "function") productFulfilmentOptions.querySelectorAll("input[type=checkbox]").forEach(function (input) { input.checked = selected.has(input.value); });
  }
  function updateProductPriceControls() {
    if (productPriceValueWrap) productPriceValueWrap.hidden = productFields.priceMode.value === "contact";
    if (productFields.priceMode.value === "contact") productFields.price.value = "";
  }
  function updateProductFulfilmentControls() {
    if (productFulfilmentOptions) productFulfilmentOptions.hidden = productFields.fulfilmentMode.value !== "specific";
    if (productFields.fulfilmentMode.value !== "specific") setProductFulfilment([]);
  }

  function safeProductImageUrl(value) {
    const text = typeof value === "string" ? value.trim() : "";
    return !text || /^https?:\/\//i.test(text);
  }
  function updateProductManagerSummary() {
    if (productsTotal) productsTotal.textContent = String(draftProducts.length);
    if (productsVisible) productsVisible.textContent = String(draftProducts.filter(function (product) { return product.customerVisible !== false; }).length);
    if (productsImages) productsImages.textContent = String(draftProducts.filter(function (product) { return Boolean(product.imageUrl); }).length);
  }
  function updateProductImagePreview() {
    if (!productImagePreview || !productImagePreviewImg) return;
    const imageUrl = productFields.image.value.trim();
    const show = Boolean(imageUrl && safeProductImageUrl(imageUrl));
    productImagePreview.hidden = !show;
    if (show) {
      productImagePreviewImg.src = imageUrl;
      productImagePreviewImg.alt = productFields.name.value.trim() ? productFields.name.value.trim() + " customer image preview" : "Customer product image preview";
    } else {
      productImagePreviewImg.src = "";
      productImagePreviewImg.alt = "";
    }
  }
  function renderBusinessProducts() {
    if (!productsList) return;
    productsList.textContent = "";
    updateProductManagerSummary();
    if (productsEmpty) productsEmpty.hidden = draftProducts.length > 0;
    draftProducts.forEach(function (product) {
      const card = document.createElement("article"); card.className = "business-product-card";
      if (product.imageUrl) {
        const image = document.createElement("img"); image.src = product.imageUrl; image.alt = product.name; image.loading = "lazy";
        card.appendChild(image);
      }
      const body = document.createElement("div"); body.className = "business-product-card-body";
      const name = document.createElement("h5"); name.textContent = product.name;
      const description = document.createElement("p"); description.textContent = product.description;
      const meta = document.createElement("p"); meta.textContent = [product.price, product.availability === "contact" ? "Contact to confirm availability" : product.availability].filter(Boolean).join(" · ");
      const visibility = document.createElement("p"); visibility.className = "business-product-visibility"; visibility.textContent = product.customerVisible === false ? "Hidden from customers" : "Visible when genuinely relevant";
      const actions = document.createElement("div"); actions.className = "business-product-card-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "demeos-secondary-button"; edit.textContent = "Edit";
      edit.addEventListener("click", function () {
        productFields.id.value = product.productId; productFields.name.value = product.name; productFields.price.value = product.price || "";
        productFields.priceMode.value = product.priceMode || (product.price ? "fixed" : "contact"); updateProductPriceControls();
        productFields.description.value = product.description; productFields.image.value = product.imageUrl || ""; updateProductImagePreview();
        productFields.route.value = product.continuationRoute || ""; productFields.availability.value = product.availability || "contact";
        productFields.visibility.value = product.customerVisible === false ? "hidden" : "visible";
        productFields.fulfilmentMode.value = product.fulfilment && Array.isArray(product.fulfilment.methods) ? "specific" : "business";
        setProductFulfilment(product.fulfilment && product.fulfilment.methods); updateProductFulfilmentControls();
        productAddBtn.textContent = "Update product / service"; productCancelBtn.hidden = false;
        if (typeof productFields.name.focus === "function") productFields.name.focus();
      });
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "demeos-secondary-button"; remove.textContent = "Remove";
      remove.addEventListener("click", function () {
        const removingEditedProduct = productFields.id.value === product.productId;
        draftProducts = draftProducts.filter(function (entry) { return entry.productId !== product.productId; });
        if (removingEditedProduct) resetProductForm();
        renderBusinessProducts();
      });
      actions.append(edit, remove); body.append(name, description, meta, visibility, actions); card.appendChild(body); productsList.appendChild(card);
    });
  }
  function resetProductForm() {
    productFields.id.value = ""; productFields.name.value = ""; productFields.price.value = "";
    productFields.description.value = ""; productFields.image.value = ""; productFields.route.value = "";
    productFields.availability.value = "contact"; productFields.visibility.value = "visible"; productFields.priceMode.value = "contact";
    productFields.fulfilmentMode.value = "business"; setProductFulfilment([]); updateProductPriceControls(); updateProductFulfilmentControls(); updateProductImagePreview();
    if (productAddBtn) productAddBtn.textContent = "Add product / service";
    if (productCancelBtn) productCancelBtn.hidden = true;
  }
  function addDraftProduct() {
    const name = productFields.name.value.trim(), description = productFields.description.value.trim(), imageUrl = productFields.image.value.trim();
    if (!name || !description) { alert("Please add a product/service name and description."); return; }
    if (!safeProductImageUrl(imageUrl)) { alert("Product image links must use http or https."); return; }
    const selectedRoutes = selectedValues(continuationRouteIds);
    const route = productFields.route.value || selectedRoutes.find(function (candidate) {
      return ["website", "booking", "phone", "whatsapp", "email", "visit", "quote"].includes(candidate);
    }) || "";
    if (!route) { alert("Select a customer continuation route before adding this product."); return; }
    if (!selectedRoutes.includes(route)) { alert("Select that customer route in the Business Profile before assigning it to a product."); return; }
    const productId = productFields.id.value || ("product-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
    const priceMode = productFields.priceMode.value;
    const price = productFields.price.value.trim();
    if (priceMode !== "contact" && !price) { alert("Add the business-provided price information for this product."); return; }
    const productFulfilment = selectedProductFulfilment();
    if (productFields.fulfilmentMode.value === "specific" && !productFulfilment.length) { alert("Choose at least one fulfilment method for this product."); return; }
    const product = { productId, name, description, price, priceMode, imageUrl,
      continuationRoute: route, availability: productFields.availability.value, customerVisible: productFields.visibility.value !== "hidden",
      imageSource: imageUrl ? "business-provided" : "",
      ...(productFields.fulfilmentMode.value === "specific" ? { fulfilment: { methods: productFulfilment } } : {}) };
    const existingIndex = draftProducts.findIndex(function (entry) { return entry.productId === productId; });
    if (existingIndex >= 0) draftProducts.splice(existingIndex, 1, product); else draftProducts.push(product);
    resetProductForm(); renderBusinessProducts();
  }
  if (productAddBtn) productAddBtn.addEventListener("click", addDraftProduct);
  if (productCancelBtn) productCancelBtn.addEventListener("click", resetProductForm);
  if (productFields.priceMode) productFields.priceMode.addEventListener("change", updateProductPriceControls);
  if (productFields.fulfilmentMode) productFields.fulfilmentMode.addEventListener("change", updateProductFulfilmentControls);
  if (productFields.image) productFields.image.addEventListener("input", updateProductImagePreview);
  if (productFields.name) productFields.name.addEventListener("input", updateProductImagePreview);

  function fillProfile(profile) {
    draftProducts = profile && Array.isArray(profile.products) ? profile.products.map(function (product) { return { ...product }; }) : [];
    renderBusinessProducts();
    resetProductForm();
    Object.keys(fields).forEach(function (key) { fields[key].value = (profile && profile[key]) || ""; });
    const continuation = profile && profile.customerContinuation ? profile.customerContinuation : {};
    setSelectedValues(continuationRouteIds, continuation.routes);
    continuationDetails.website.value = continuation.website || "";
    continuationDetails.phone.value = continuation.phone || "";
    continuationDetails.whatsapp.value = continuation.whatsapp || "";
    continuationDetails.email.value = continuation.email || "";
    continuationDetails.bookingLink.value = continuation.bookingLink || "";
    continuationDetails.visitAddress.value = continuation.visitAddress || "";
    updateContinuationDetailVisibility();
    const fulfilment = profile && profile.fulfilment ? profile.fulfilment : {};
    setSelectedValues(fulfilmentIds, fulfilment.methods);
    fulfilmentNotes.value = fulfilment.notes || "";
    const operational = profile && profile.operationalAvailability ? profile.operationalAvailability : {};
    availabilityStatus.value = operational.status || "contact";
    businessHoursNotes.value = operational.hoursNotes || "";
    availabilityNotes.value = operational.notes || "";
    accuracyConfirmation.checked = false;
    if (businessProfileStatus) {
      businessProfileStatus.textContent = profile && profile.informationStatus
        ? "Saved as business-provided information. Reconfirm accuracy when you make changes."
        : "";
    }
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

  async function loadAuthorizedBusinesses() {
    if (!serverAuthorizationRequired) return;
    try {
      const response = await fetch("/api/businesses", { credentials: "same-origin" });
      const payload = response.ok ? await response.json() : { businesses: [] };
      state = applyAuthorizedBusinessProfiles(cachedBusinessState.profiles, payload.businesses,
        localStorage.getItem("demeosActiveBusinessId"));
    } catch (_error) {
      state = { profiles: [], activeBusinessId: null };
    }
    localStorage.setItem("demeosBusinessProfiles", JSON.stringify(state.profiles));
    if (state.activeBusinessId) localStorage.setItem("demeosActiveBusinessId", state.activeBusinessId);
    else localStorage.removeItem("demeosActiveBusinessId");
    renderSelector(); fillProfile(activeProfile()); renderActiveMarketingWork();
    renderCustomerParticipationResults(); renderCampaignHistory();
    if (state.activeBusinessId) hydrateActiveBusiness();
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
    campaignOutcome.hidden = true;
    campaignOutcomeValue.value = "";
    campaignOutcomeNote.value = "";
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
  function renderCampaignOutcome(campaign) {
    const approved = campaign && campaign.approvalStatus === "Approved";
    campaignOutcome.hidden = !approved;
    campaignOutcomeValue.value = approved && campaign.outcome ? campaign.outcome.outcome : "";
    campaignOutcomeNote.value = approved && campaign.outcome ? campaign.outcome.ownerNote || "" : "";
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
    const overviewList = byId("overview-campaigns-list");
    const overviewEmpty = byId("overview-campaigns-empty");
    if (overviewList && overviewEmpty) {
      overviewList.textContent = ""; overviewEmpty.hidden = visible.length > 0;
      visible.slice(0, 3).forEach(function (campaign) {
        const item = document.createElement("div"); item.className = "compact-list-item";
        const name = document.createElement("strong"); name.textContent = campaign.campaignTypeLabel || campaign.campaignType || "Campaign";
        const status = document.createElement("span"); status.textContent = campaign.approvalStatus === "Approved" ? "Approved" : "Unapproved";
        item.append(name, status); overviewList.appendChild(item);
      });
    }
    renderCampaignResults();
    renderRecommendationDecisionResults();
    renderCustomerParticipationResults();
  }
  function renderCampaignResults() {
    const outcomes = addingBusiness ? [] : getVisibleCampaigns(getCampaignHistory(), activeProfile()).filter(function (campaign) {
      return campaign && campaign.outcome && campaign.outcome.outcome;
    });
    const resultsList = byId("campaign-results-list");
    const resultsEmpty = byId("campaign-results-empty");
    const overviewList = byId("overview-results-list");
    const overviewEmpty = byId("overview-results-empty");
    if (resultsList && resultsEmpty) { resultsList.textContent = ""; resultsEmpty.hidden = outcomes.length > 0; }
    if (overviewList && overviewEmpty) { overviewList.textContent = ""; overviewEmpty.hidden = outcomes.length > 0; }
    outcomes.forEach(function (campaign, index) {
      const item = document.createElement("article"); item.className = "result-record";
      const heading = document.createElement("h4"); heading.textContent = campaign.campaignTypeLabel || campaign.campaignType || "Campaign";
      const outcome = document.createElement("strong"); outcome.textContent = campaign.outcome.outcome;
      const note = document.createElement("p"); note.textContent = campaign.outcome.ownerNote || "No note recorded.";
      item.append(heading, outcome, note); if (resultsList) resultsList.appendChild(item);
      if (overviewList && index < 3) {
        const summary = document.createElement("div"); summary.className = "compact-list-item";
        const label = document.createElement("strong"); label.textContent = heading.textContent;
        const value = document.createElement("span"); value.textContent = campaign.outcome.outcome;
        summary.append(label, value); overviewList.appendChild(summary);
      }
    });
  }
  function renderRecommendationDecisionResults() {
    const campaignLabels = { full: "Full Marketing Campaign", social: "Social Media Campaign", email: "Email Campaign" };
    const decisionLabels = { used: "Used", modified: "Modified", rejected: "Not for me" };
    const stored = parseStoredJson(localStorage, recommendationDecisionsKey, []);
    const decisions = addingBusiness || !Array.isArray(stored) ? [] : stored.filter(function (decision) {
      return decision && decision.businessId === state.activeBusinessId &&
        typeof decision.recommendationTitle === "string" && Boolean(decision.recommendationTitle.trim()) &&
        Object.hasOwn(campaignLabels, decision.suggestedCampaignType) &&
        Object.hasOwn(decisionLabels, decision.decision) && typeof decision.timestamp === "string" &&
        Number.isFinite(Date.parse(decision.timestamp));
    }).sort(function (left, right) { return Date.parse(right.timestamp) - Date.parse(left.timestamp); });
    if (recommendationDecisionsResultsList) recommendationDecisionsResultsList.textContent = "";
    if (recommendationDecisionsResultsEmpty) recommendationDecisionsResultsEmpty.hidden = decisions.length > 0;
    decisions.forEach(function (decision) {
      const item = document.createElement("article"); item.className = "result-record recommendation-decision-result";
      const title = document.createElement("h4"); title.textContent = decision.recommendationTitle.trim();
      const campaign = document.createElement("p"); campaign.textContent = `Campaign type: ${campaignLabels[decision.suggestedCampaignType]}`;
      const ownerDecision = document.createElement("p"); ownerDecision.textContent = `Owner decision: ${decisionLabels[decision.decision]}`;
      const timestamp = document.createElement("p"); timestamp.textContent = `Decision date: ${new Date(decision.timestamp).toLocaleString()}`;
      item.append(title, campaign, ownerDecision, timestamp);
      if (recommendationDecisionsResultsList) recommendationDecisionsResultsList.appendChild(item);
    });
  }
  function renderActiveMarketingWork() {
    const work = addingBusiness ? [] : getActiveMarketingWork(getCampaignHistory(), state.activeBusinessId);
    activeMarketingWorkList.textContent = "";
    activeMarketingWorkEmpty.hidden = work.length > 0;
    work.forEach(function (entry) {
      const campaign = entry.campaign;
      const item = document.createElement("article"); item.className = "active-marketing-work-item";
      const type = document.createElement("h4");
      type.textContent = campaign.campaignTypeLabel || campaign.campaignType || "Campaign";
      const purpose = document.createElement("p"); purpose.className = "active-marketing-work-purpose";
      purpose.textContent = typeof campaign.promoText === "string" && campaign.promoText.trim()
        ? campaign.promoText : "Marketing request not stored.";
      const status = document.createElement("p"); status.className = "active-marketing-work-status";
      status.textContent = entry.status;
      const action = document.createElement("button"); action.type = "button"; action.textContent = entry.action;
      action.addEventListener("click", function () {
        openCampaign(campaign.id);
        if (entry.action === "Record Outcome") {
          if (typeof campaignOutcome.scrollIntoView === "function") campaignOutcome.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof campaignOutcomeValue.focus === "function") campaignOutcomeValue.focus();
        }
      });
      item.append(type, purpose, status);
      item.appendChild(action); activeMarketingWorkList.appendChild(item);
    });
    const overviewList = byId("overview-active-list");
    const overviewEmpty = byId("overview-active-empty");
    if (overviewList && overviewEmpty) {
      overviewList.textContent = ""; overviewEmpty.hidden = work.length > 0;
      work.slice(0, 3).forEach(function (entry) {
        const item = document.createElement("div"); item.className = "compact-list-item";
        const type = document.createElement("strong"); type.textContent = entry.campaign.campaignTypeLabel || entry.campaign.campaignType || "Campaign";
        const status = document.createElement("span"); status.textContent = entry.status;
        item.append(type, status); overviewList.appendChild(item);
      });
    }
  }
  function renderCustomerParticipationResults() {
    const results = addingBusiness ? [] : getCustomerParticipationResults(customerParticipationResults, state.activeBusinessId);
    if (customerParticipationResultsList) customerParticipationResultsList.textContent = "";
    if (customerParticipationResultsEmpty) customerParticipationResultsEmpty.hidden = results.length > 0;
    results.forEach(function (result) {
      const item = document.createElement("article"); item.className = "customer-participation-result";
      const name = document.createElement("h4"); name.textContent = result.name;
      const count = document.createElement("p"); count.className = "customer-participation-count";
      count.textContent = `${result.customerInterestCount} customer${result.customerInterestCount === 1 ? "" : "s"} interested`;
      const latest = document.createElement("p"); latest.className = "customer-participation-latest";
      latest.textContent = result.latestParticipationAt
        ? `Latest participation: ${new Date(result.latestParticipationAt).toLocaleString()}`
        : "No participation recorded yet.";
      item.append(name, count, latest);
      if (customerParticipationResultsList) customerParticipationResultsList.appendChild(item);
    });
    const overviewList = byId("overview-results-list");
    const overviewEmpty = byId("overview-results-empty");
    if (overviewList && overviewEmpty && results.length) {
      overviewEmpty.hidden = true;
      results.slice(0, 3).forEach(function (result) {
        const item = document.createElement("div"); item.className = "compact-list-item";
        const name = document.createElement("strong"); name.textContent = result.name;
        const count = document.createElement("span"); count.textContent = `${result.customerInterestCount} customer${result.customerInterestCount === 1 ? "" : "s"} interested`;
        item.append(name, count); overviewList.appendChild(item);
      });
    }
  }
  function switchBusiness(businessId) {
    if (!state.profiles.some(function (profile) { return profile.businessId === businessId; })) return;
    state.activeBusinessId = businessId; addingBusiness = false;
    localStorage.setItem("demeosActiveBusinessId", businessId);
    customerParticipationResults = []; selectedRecommendationDecision = null;
    renderRecommendsUnderstanding(null, businessId);
    clearRecommendations(); clearBusinessSituation(); fillProfile(activeProfile()); renderSelector(); clearCampaignWorkspace(); renderActiveMarketingWork(); renderCustomerParticipationResults(); renderCampaignHistory();
    hydrateActiveBusiness();
  }
  async function saveCampaign(text, promo, type, typeLabel, profile, sourceId, recommendationDecision) {
    const campaigns = getCampaignHistory();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const source = sourceId ? campaigns.find(function (entry) { return entry.id === sourceId; }) : null;
    const continuity = createCampaignContinuity(id, source);
    const campaign = { id, campaignText: text, campaignType: type, campaignTypeLabel: typeLabel, promoText: promo,
      businessName: profile.name, businessId: getCampaignBusinessId(profile, source), createdAt: new Date().toISOString(),
      approvalStatus: "Unapproved", ...(recommendationDecision && recommendationDecision.decisionId
        ? { recommendationDecisionId: recommendationDecision.decisionId,
          recommendationId: recommendationDecision.recommendationId,
          recommendationAction: recommendationDecision.decision } : source && source.recommendationDecisionId
          ? { recommendationDecisionId: source.recommendationDecisionId,
            ...(source.recommendationId ? { recommendationId: source.recommendationId } : {}),
            ...(source.recommendationAction ? { recommendationAction: source.recommendationAction } : {}) } : {}), ...continuity };
    campaigns.unshift(campaign);
    const retained = enforceBusinessCampaignLimit(campaigns, profile.businessId, 20, [id, sourceId]);
    localStorage.setItem(campaignHistoryKey, JSON.stringify(retained)); openCampaignId = id; renderActiveMarketingWork(); renderCampaignHistory(); renderCampaignVersions();
    const persisted = await persistCampaign(profile, campaign); return { id, persisted };
  }

  Object.keys(continuationRouteIds).forEach(function (route) {
    const checkbox = byId(continuationRouteIds[route]);
    if (checkbox) checkbox.addEventListener("change", updateContinuationDetailVisibility);
  });
  renderSelector(); fillProfile(activeProfile()); renderActiveMarketingWork(); renderCustomerParticipationResults(); renderCampaignHistory();
  if (serverAuthorizationRequired) loadAuthorizedBusinesses();
  else hydrateActiveBusiness();
  businessSelector.addEventListener("change", function () { switchBusiness(businessSelector.value); });
  addBusinessBtn.addEventListener("click", function () {
    addingBusiness = true; customerParticipationResults = []; selectedRecommendationDecision = null; businessSelector.value = ""; fillProfile(null); clearRecommendations(); clearBusinessSituation(); clearCampaignWorkspace(); renderActiveMarketingWork(); renderCustomerParticipationResults(); renderRecommendationDecisionResults(); renderRecommendsUnderstanding(null, null);
  });
  saveBusinessProfileBtn.addEventListener("click", async function () {
    const profileFields = {};
    Object.keys(fields).forEach(function (key) { profileFields[key] = fields[key].value.trim(); });
    if (Object.keys(profileFields).some(function (key) { return !profileFields[key]; })) {
      alert("Please complete the business details, products/services and marketing profile before saving."); return;
    }
    const routes = selectedValues(continuationRouteIds);
    const fulfilmentMethods = selectedValues(fulfilmentIds);
    if (!routes.length) {
      alert("Please select at least one way customers can continue with your business."); return;
    }
    if (!fulfilmentMethods.length) {
      alert("Please select at least one way customers receive your product or service."); return;
    }
    const details = getContinuationDetails();
    const routeRequirements = { website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", booking: "bookingLink" };
    const missingRoute = Object.keys(routeRequirements).find(function (route) {
      return routes.includes(route) && !details[routeRequirements[route]];
    });
    if (missingRoute) {
      alert("Please provide the contact or link information for each customer route you selected."); return;
    }
    if (routes.includes("quote") && !routes.some(function (route) { return ["email", "phone", "whatsapp", "website", "booking"].includes(route); })) {
      alert("Request quote / enquiry needs at least one contact route so customers can actually continue."); return;
    }
    if (!accuracyConfirmation.checked) {
      alert("Please confirm that the Business Profile information is accurate before saving."); return;
    }
    profileFields.profileVersion = 4;
    profileFields.products = draftProducts.map(function (product) { return { ...product }; });
    profileFields.operationalAvailability = {
      status: availabilityStatus.value,
      hoursNotes: businessHoursNotes.value.trim(),
      notes: availabilityNotes.value.trim()
    };
    profileFields.customerContinuation = { routes, ...details };
    profileFields.fulfilment = { methods: fulfilmentMethods, notes: fulfilmentNotes.value.trim() };

    saveBusinessProfileBtn.disabled = true;
    saveBusinessProfileBtn.textContent = "Saving Business Profile...";
    try {
      const wasAddingBusiness = addingBusiness;
      const result = updateBusinessProfile(state.profiles, profileFields, wasAddingBusiness ? null : state.activeBusinessId);
      if (!wasAddingBusiness) {
        state = { profiles: result.profiles, activeBusinessId: result.profile.businessId };
        localStorage.setItem("demeosBusinessProfiles", JSON.stringify(state.profiles));
        localStorage.setItem("demeosActiveBusinessId", state.activeBusinessId);
        renderSelector(); fillProfile(result.profile); clearRecommendations(); clearCampaignWorkspace();
        renderActiveMarketingWork(); renderCampaignHistory();
      }
      addPendingBusinessProfileSync(localStorage, result.profile.businessId);
      const persisted = await persistBusiness(result.profile, { ownerAccuracyConfirmed: true });
      if (persisted) {
        if (wasAddingBusiness) {
          state = { profiles: result.profiles, activeBusinessId: result.profile.businessId };
          localStorage.setItem("demeosBusinessProfiles", JSON.stringify(state.profiles));
          localStorage.setItem("demeosActiveBusinessId", state.activeBusinessId);
          renderSelector(); fillProfile(result.profile); clearRecommendations(); clearCampaignWorkspace();
          renderActiveMarketingWork(); renderCampaignHistory();
        }
        addingBusiness = false;
        removePendingBusinessProfileSync(localStorage, result.profile.businessId);
        alert("Business Profile saved successfully.");
      } else {
        // Failed edits retain their existing retry marker. Failed creations are not
        // cached as owned businesses and therefore must not become selectable.
        if (wasAddingBusiness) removePendingBusinessProfileSync(localStorage, result.profile.businessId);
        alert(wasAddingBusiness
          ? "DEMEOS could not create this business. It was not added to your businesses."
          : "DEMEOS could not save this Business Profile. Please try again.");
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

  function getMarketingReadiness(profile) {
    const labels = { name: "Business Name", type: "Business Type", location: "Business Location / Service Area",
      brandVoice: "Brand Voice", targetCustomer: "Target Customer",
      goal: "Primary Marketing Goal" };
    if (!profile || typeof profile !== "object") return { ready: false, missing: Object.values(labels) };
    const missing = Object.keys(labels).filter(function (key) {
      return typeof profile[key] !== "string" || !profile[key].trim();
    }).map(function (key) { return labels[key]; });
    if (profile.profileVersion >= 4) {
      if (!profile.customerContinuation || !Array.isArray(profile.customerContinuation.routes) || !profile.customerContinuation.routes.length) {
        missing.push("Customer continuation route");
      }
      if (!profile.fulfilment || !Array.isArray(profile.fulfilment.methods) || !profile.fulfilment.methods.length) {
        missing.push("Customer fulfilment method");
      }
    }
    return { ready: missing.length === 0, missing };
  }

  function guideOwnerToCompleteProfile(readiness) {
    clearRecommendations();
    recommendationsStatus.textContent = "Before DEMEOS recommends marketing work, complete: " + readiness.missing.join(", ") + ".";
    showWorkspaceView("business-profile");
    const profileHeading = byId("business-profile-heading");
    if (profileHeading && typeof profileHeading.focus === "function") profileHeading.focus();
  }

  recommendationsBtn.addEventListener("click", async function () {
    const profile = activeProfile();
    if (!profile || addingBusiness) { alert("Please complete and save your Business Manager Profile before requesting recommendations."); return; }
    const readiness = getMarketingReadiness(profile);
    if (!readiness.ready) { guideOwnerToCompleteProfile(readiness); return; }
    const requestedBusinessId = profile.businessId;
    clearRecommendations(); recommendationsBtn.disabled = true;
    recommendationsStatus.textContent = "DEMEOS is reviewing your business...";
    try {
      const campaignOutcomes = getCampaignOutcomes(getCampaignHistory(), requestedBusinessId);
      const recommendationDecisions = getRecommendationDecisionContext(
        parseStoredJson(localStorage, recommendationDecisionsKey, []), requestedBusinessId);
      const response = await fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: profile.businessId, businessProfile: profile, businessSituation: businessSituation.value.trim(), campaignOutcomes, recommendationDecisions }) });
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
    campaignOutcome.hidden = true;
    campaignVersionsList.textContent = ""; campaignVersions.hidden = true;
    try {
      const text = await requestCampaign({ businessId: profile.businessId, promoText: promo, campaignType: campaignType.value, businessProfile: profile });
      renderCampaign({ campaignText: text, campaignType: campaignType.value }); copyBtn.hidden = false;
      const recommendationDecision = selectedRecommendationDecision ? await selectedRecommendationDecision : null;
      selectedRecommendationDecision = null;
      const saved = await saveCampaign(text, promo, campaignType.value, campaignType.options[campaignType.selectedIndex].text, profile, undefined, recommendationDecision);
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
      const request = { businessId: profile.businessId, existingCampaign: source.campaignText, revisionInstruction: instruction, campaignType: type, businessProfile: profile };
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
    renderActiveMarketingWork(); renderCampaignHistory(); approveBtn.disabled = true; approveBtn.textContent = "Saving Approval...";
    try {
      const persisted = await persistCampaign(activeProfile(), campaign);
      showApprovalStatus("Approved");
      renderCampaignOutcome(campaign);
      if (!persisted) {
        approveBtn.hidden = false;
        alert("Approval saved on this device, but DEMEOS could not sync it to the server. Please try again.");
      }
    } finally { approveBtn.disabled = false; approveBtn.textContent = "Approve Campaign"; }
  });
  saveCampaignOutcomeBtn.addEventListener("click", async function () {
    const campaigns = getCampaignHistory();
    const campaign = campaigns.find(function (entry) { return entry.id === openCampaignId; });
    const profile = activeProfile();
    if (!campaign || campaign.approvalStatus !== "Approved" || !canAccessCampaign(campaign, profile)) return;
    if (!campaignOutcomeValue.value) { alert("Please select an outcome."); return; }
    saveCampaignOutcomeBtn.disabled = true; saveCampaignOutcomeBtn.textContent = "Saving Outcome...";
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(profile.businessId)}/campaigns/${encodeURIComponent(campaign.id)}/outcome`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: campaignOutcomeValue.value, ownerNote: campaignOutcomeNote.value })
      });
      const data = await response.json();
      if (!response.ok || !data.outcome) throw new Error(data.error || "DEMEOS could not save this outcome.");
      campaign.outcome = data.outcome;
      localStorage.setItem(campaignHistoryKey, JSON.stringify(campaigns));
      renderCampaignOutcome(campaign); renderActiveMarketingWork();
    } catch (error) { alert(error.message); }
    finally { saveCampaignOutcomeBtn.disabled = false; saveCampaignOutcomeBtn.textContent = "Save Outcome"; }
  });
  copyBtn.addEventListener("click", async function () {
    copyText(currentCampaignText, copyBtn, "Copy Campaign");
  });
});
