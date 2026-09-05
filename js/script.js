function getCampaignContinuity(campaign) {
  const revisionNumber = Number.isInteger(campaign && campaign.revisionNumber) && campaign.revisionNumber >= 0
    ? campaign.revisionNumber
    : 0;

  return {
    originalMarketingWorkId: (campaign && campaign.originalMarketingWorkId) || (campaign && campaign.id) || null,
    revisionNumber: revisionNumber
  };
}

function createCampaignContinuity(campaignId, sourceCampaign) {
  if (!sourceCampaign) {
    return {
      originalMarketingWorkId: campaignId,
      revisionNumber: 0
    };
  }

  const sourceContinuity = getCampaignContinuity(sourceCampaign);

  return {
    originalMarketingWorkId: sourceContinuity.originalMarketingWorkId || campaignId,
    revisionNumber: sourceContinuity.revisionNumber + 1
  };
}

function getCampaignContinuityLabel(campaign) {
  const revisionNumber = getCampaignContinuity(campaign).revisionNumber;
  return revisionNumber === 0 ? "Original" : `Revision ${revisionNumber}`;
}

function createBusinessId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `business-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addBusinessIdentity(profile, savedProfile) {
  return {
    ...profile,
    businessId: (savedProfile && savedProfile.businessId) || profile.businessId || createBusinessId()
  };
}

function getCampaignBusinessId(profile, sourceCampaign) {
  return (sourceCampaign && sourceCampaign.businessId) || (profile && profile.businessId);
}

function canAccessCampaign(campaign, profile) {
  return Boolean(campaign) && (
    !campaign.businessId ||
    Boolean(profile && profile.businessId && campaign.businessId === profile.businessId)
  );
}

function getVisibleCampaigns(campaigns, profile) {
  return campaigns.filter(function (campaign) {
    return canAccessCampaign(campaign, profile);
  });
}

function enforceBusinessCampaignLimit(campaigns, businessId, maximumCampaigns, protectedCampaignIds) {
  const retainedCampaigns = campaigns.slice();
  const protectedIds = new Set(protectedCampaignIds.filter(Boolean));
  let businessCampaignCount = retainedCampaigns.filter(function (campaign) {
    return campaign.businessId === businessId;
  }).length;

  for (let index = retainedCampaigns.length - 1;
    businessCampaignCount > maximumCampaigns && index >= 0;
    index -= 1) {
    const campaign = retainedCampaigns[index];

    if (campaign.businessId === businessId && !protectedIds.has(campaign.id)) {
      retainedCampaigns.splice(index, 1);
      businessCampaignCount -= 1;
    }
  }

  return retainedCampaigns;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    addBusinessIdentity,
    canAccessCampaign,
    createCampaignContinuity,
    enforceBusinessCampaignLimit,
    getCampaignBusinessId,
    getCampaignContinuity,
    getCampaignContinuityLabel,
    getVisibleCampaigns
  };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {

  const generateBtn = document.getElementById("generate-btn");

  const promoInput = document.getElementById("promo-input");
  const campaignType = document.getElementById("campaign-type");

  const resultsArea = document.getElementById("results");

  const resultsContent = document.getElementById("results-content");
  const copyBtn = document.getElementById("copy-btn");
  const approveBtn = document.getElementById("approve-btn");
  const revisionControls = document.getElementById("campaign-revision-controls");
  const revisionInstruction = document.getElementById("revision-instruction");
  const reviseBtn = document.getElementById("revise-btn");
  const campaignApprovalStatus = document.getElementById("campaign-approval-status");
  const campaignHistoryList = document.getElementById("campaign-history-list");
  const campaignHistoryEmpty = document.getElementById("campaign-history-empty");
  const campaignHistoryKey = "demeosCampaignHistory";
  const maximumSavedCampaigns = 20;
  let openCampaignId = null;
const businessName = document.getElementById("business-name");

const businessType = document.getElementById("business-type");
const businessTargetCustomer = document.getElementById("business-target-customer");
const businessGoal = document.getElementById("business-goal");
const businessLocation = document.getElementById("business-location");

const businessBrandVoice = document.getElementById("business-brand-voice");

const saveBusinessProfileBtn = document.getElementById("save-business-profile-btn");

function getSavedBusinessProfile() {
  const savedProfile = localStorage.getItem("demeosBusinessProfile");

  if (!savedProfile) {
    return null;
  }

  const businessProfile = JSON.parse(savedProfile);

  if (businessProfile.businessId) {
    return businessProfile;
  }

  const profileWithIdentity = addBusinessIdentity(businessProfile);
  localStorage.setItem("demeosBusinessProfile", JSON.stringify(profileWithIdentity));
  return profileWithIdentity;
}

function getCampaignHistory() {

  try {

    const savedCampaigns = JSON.parse(localStorage.getItem(campaignHistoryKey)) || [];

    return Array.isArray(savedCampaigns) ? savedCampaigns : [];

  } catch (error) {

    console.error("Could not read campaign history:", error);
    return [];

  }

}

function renderCampaignHistory() {

  const savedCampaigns = getVisibleCampaigns(getCampaignHistory(), getSavedBusinessProfile());

  campaignHistoryList.textContent = "";
  campaignHistoryEmpty.hidden = savedCampaigns.length > 0;

  savedCampaigns.forEach(function (savedCampaign, index) {

    const item = document.createElement("article");
    item.className = "campaign-history-item";

    const heading = document.createElement("h4");
    heading.textContent = savedCampaign.businessName || "Business name unavailable";

    const details = document.createElement("p");
    details.className = "campaign-history-details";
    details.textContent = `${savedCampaign.campaignTypeLabel || savedCampaign.campaignType || "Campaign"} · ${new Date(savedCampaign.createdAt).toLocaleString()}`;

    const continuityLabel = document.createElement("span");
    continuityLabel.className = "campaign-history-continuity";
    continuityLabel.textContent = getCampaignContinuityLabel(savedCampaign);
    details.prepend(continuityLabel, " · ");

    const preview = document.createElement("p");
    preview.className = "campaign-history-preview";
    preview.textContent = savedCampaign.campaignText || "";

    const approvalStatus = document.createElement("p");
    approvalStatus.className = `campaign-history-status ${savedCampaign.approvalStatus === "Approved" ? "is-approved" : ""}`;
    approvalStatus.textContent = savedCampaign.approvalStatus === "Approved" ? "Approved" : "Unapproved";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "demeos-primary-button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", function () {

      const campaign = getCampaignHistory().find(function (savedCampaign) {
        return savedCampaign.id === savedCampaigns[index].id;
      });

      if (!canAccessCampaign(campaign, getSavedBusinessProfile())) {
        alert("This campaign belongs to a different business profile.");
        return;
      }

      resultsContent.textContent = campaign.campaignText;
      openCampaignId = campaign.id || null;
      showApprovalStatus(campaign.approvalStatus);
      resultsArea.hidden = false;
      copyBtn.hidden = false;
      revisionControls.hidden = false;
      revisionInstruction.value = "";
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });

    });

    item.append(heading, details, approvalStatus, preview, openButton);
    campaignHistoryList.appendChild(item);

  });

}

function saveCampaign(campaignText, promoText, selectedCampaignType, campaignTypeLabel, profile, sourceCampaignId) {

  const savedCampaigns = getCampaignHistory();

  const campaignId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const sourceCampaign = sourceCampaignId
    ? savedCampaigns.find(function (savedCampaign) {
      return savedCampaign.id === sourceCampaignId;
    })
    : null;
  const continuity = createCampaignContinuity(campaignId, sourceCampaign);
  const businessId = getCampaignBusinessId(profile, sourceCampaign);

  savedCampaigns.unshift({
    id: campaignId,
    campaignText: campaignText,
    campaignType: selectedCampaignType,
    campaignTypeLabel: campaignTypeLabel,
    promoText: promoText,
    businessName: profile.name,
    businessId: businessId,
    createdAt: new Date().toISOString(),
    approvalStatus: "Unapproved",
    originalMarketingWorkId: continuity.originalMarketingWorkId,
    revisionNumber: continuity.revisionNumber
  });

  const retainedCampaigns = enforceBusinessCampaignLimit(
    savedCampaigns,
    businessId,
    maximumSavedCampaigns,
    [campaignId, sourceCampaignId]
  );

  localStorage.setItem(
    campaignHistoryKey,
    JSON.stringify(retainedCampaigns)
  );

  // Saving is also the state transition to the newly created marketing work.
  // Keep this here so every save path uses the saved record for the next action.
  openCampaignId = campaignId;
  renderCampaignHistory();

  return campaignId;

}

function showApprovalStatus(approvalStatus) {

  const isApproved = approvalStatus === "Approved";

  campaignApprovalStatus.textContent = isApproved ? "Status: Approved" : "Status: Unapproved";
  campaignApprovalStatus.classList.toggle("is-approved", isApproved);
  campaignApprovalStatus.hidden = false;
  approveBtn.hidden = isApproved;

}

renderCampaignHistory();
const businessProfile = getSavedBusinessProfile();

if (businessProfile) {

  businessName.value = businessProfile.name || "";

  businessType.value = businessProfile.type || "";

  businessLocation.value = businessProfile.location || "";

  businessBrandVoice.value = businessProfile.brandVoice || "";
businessTargetCustomer.value = businessProfile.targetCustomer || "";
businessGoal.value = businessProfile.goal || "";
}
saveBusinessProfileBtn.addEventListener("click", function () {

  const profileFields = {

    name: businessName.value.trim(),

    type: businessType.value.trim(),

    location: businessLocation.value.trim(),

    brandVoice: businessBrandVoice.value.trim(),

targetCustomer: businessTargetCustomer.value.trim(),
goal: businessGoal.value.trim()
  };

  if (!profileFields.name || !profileFields.type || !profileFields.location || !profileFields.brandVoice || !profileFields.targetCustomer || !profileFields.goal) {

  alert("Please complete all Business Manager Profile fields before saving.");

  return;

}
  const savedProfile = getSavedBusinessProfile();
  const businessProfile = addBusinessIdentity(profileFields, savedProfile);

  localStorage.setItem(

    "demeosBusinessProfile",

    JSON.stringify(businessProfile)

  );

  alert("Business Profile saved successfully.");

});
  generateBtn.addEventListener("click", async function () {

    const promoText = promoInput.value.trim();
if (!localStorage.getItem("demeosBusinessProfile")) {

  alert("Please complete and save your Business Manager Profile before creating marketing work.");

  return;

}
    if (!promoText) {

      alert("Please tell DEMEOS what you would like to achieve first.");
      return;

    }

    generateBtn.disabled = true;

    generateBtn.textContent = "DEMEOS is working...";

    resultsArea.hidden = false;

    resultsContent.textContent = "DEMEOS is creating your marketing work...";
    copyBtn.hidden = true;
    approveBtn.hidden = true;
    campaignApprovalStatus.hidden = true;
    revisionControls.hidden = true;
    openCampaignId = null;

    try {

      const businessProfile = getSavedBusinessProfile();

      const response = await fetch("/api/generate", {

        method: "POST",

        headers: {

          "Content-Type": "application/json"

        },
          

        body: JSON.stringify({

  promoText: promoText,

campaignType: campaignType.value,

businessProfile: businessProfile
            })

    });

      const responseText = await response.text();
      let data = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (error) {
        throw new Error(
          `DEMEOS received an unreadable server response (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {

        const details = data.details ? ` ${data.details}` : "";
        const requestId = data.requestId ? ` Request ID: ${data.requestId}` : "";

        throw new Error(
          `${data.error || "DEMEOS could not generate your marketing work."}${details}${requestId}`
        );

      }

      if (typeof data.campaign !== "string" || !data.campaign.trim()) {
        throw new Error("DEMEOS returned no marketing content.");
      }

      resultsContent.textContent = data.campaign;
      copyBtn.hidden = false;

      saveCampaign(
        data.campaign,
        promoText,
        campaignType.value,
        campaignType.options[campaignType.selectedIndex].text,
        businessProfile
      );
      showApprovalStatus("Unapproved");
      revisionControls.hidden = false;

      resultsArea.scrollIntoView({

        behavior: "smooth",

        block: "start"

      });

    } catch (error) {

      console.error(error);

      resultsContent.textContent = error.message;
    } finally {

      generateBtn.disabled = false;

      generateBtn.textContent = "Create with DEMEOS";

    }

  });

reviseBtn.addEventListener("click", async function () {
  const instruction = revisionInstruction.value.trim();
  const savedCampaigns = getCampaignHistory();
  const sourceCampaign = savedCampaigns.find(function (savedCampaign) {
    return savedCampaign.id === openCampaignId;
  });

  if (!sourceCampaign) {
    alert("Please open a saved campaign before requesting a revision.");
    return;
  }

  const businessProfile = getSavedBusinessProfile();

  if (!canAccessCampaign(sourceCampaign, businessProfile)) {
    alert("This campaign belongs to a different business profile.");
    return;
  }

  if (!instruction) {
    alert("Please tell DEMEOS what you would like to change.");
    return;
  }

  if (!localStorage.getItem("demeosBusinessProfile")) {
    alert("Please complete and save your Business Manager Profile before revising marketing work.");
    return;
  }

  const sourceCampaignType = sourceCampaign.campaignType;
  const campaignTypeValue = sourceCampaignType === "Social Media Post" ? "social"
    : sourceCampaignType === "Email Campaign" ? "email"
      : sourceCampaignType === "Full Marketing Campaign" ? "full"
        : sourceCampaignType;
  const campaignTypeLabel = sourceCampaign.campaignTypeLabel ||
    (campaignTypeValue === "social" ? "Social Media Post"
      : campaignTypeValue === "email" ? "Email Campaign" : "Full Marketing Campaign");

  reviseBtn.disabled = true;
  reviseBtn.textContent = "DEMEOS is revising...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        existingCampaign: sourceCampaign.campaignText,
        revisionInstruction: instruction,
        campaignType: campaignTypeValue,
        businessProfile: businessProfile
      })
    });
    const responseText = await response.text();
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      throw new Error(`DEMEOS received an unreadable server response (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      const requestId = data.requestId ? ` Request ID: ${data.requestId}` : "";
      throw new Error(`${data.error || "DEMEOS could not revise your campaign."}${requestId}`);
    }
    if (typeof data.campaign !== "string" || !data.campaign.trim()) {
      throw new Error("DEMEOS returned no revised marketing content.");
    }

    saveCampaign(
      data.campaign,
      sourceCampaign.promoText || "",
      campaignTypeValue,
      campaignTypeLabel,
      businessProfile,
      sourceCampaign.id
    );
    resultsContent.textContent = data.campaign;
    revisionInstruction.value = "";
    copyBtn.hidden = false;
    showApprovalStatus("Unapproved");
    resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    reviseBtn.disabled = false;
    reviseBtn.textContent = "Revise Campaign";
  }
});

approveBtn.addEventListener("click", function () {

  if (!openCampaignId) {
    return;
  }

  const savedCampaigns = getCampaignHistory();
  const campaign = savedCampaigns.find(function (savedCampaign) {
    return savedCampaign.id === openCampaignId;
  });

  if (!campaign) {
    return;
  }

  if (!canAccessCampaign(campaign, getSavedBusinessProfile())) {
    alert("This campaign belongs to a different business profile.");
    return;
  }

  campaign.approvalStatus = "Approved";
  localStorage.setItem(campaignHistoryKey, JSON.stringify(savedCampaigns));
  showApprovalStatus("Approved");
  renderCampaignHistory();

});

copyBtn.addEventListener("click", async function () {

  const campaignText = resultsContent.textContent.trim();

  if (!campaignText) {

    return;

  }

  try {

    await navigator.clipboard.writeText(campaignText);

    copyBtn.textContent = "Copied!";

    setTimeout(function () {

      copyBtn.textContent = "Copy Campaign";

    }, 1500);

  } catch (error) {

    console.error("Could not copy campaign:", error);

  }

});
});
