document.addEventListener("DOMContentLoaded", function () {

  const generateBtn = document.getElementById("generate-btn");

  const promoInput = document.getElementById("promo-input");
  const campaignType = document.getElementById("campaign-type");

  const resultsArea = document.getElementById("results");

  const resultsContent = document.getElementById("results-content");
  const copyBtn = document.getElementById("copy-btn");
  const campaignHistoryList = document.getElementById("campaign-history-list");
  const campaignHistoryEmpty = document.getElementById("campaign-history-empty");
  const campaignHistoryKey = "demeosCampaignHistory";
  const maximumSavedCampaigns = 20;
const businessName = document.getElementById("business-name");

const businessType = document.getElementById("business-type");
const businessTargetCustomer = document.getElementById("business-target-customer");
const businessGoal = document.getElementById("business-goal");
const businessLocation = document.getElementById("business-location");

const businessBrandVoice = document.getElementById("business-brand-voice");

const saveBusinessProfileBtn = document.getElementById("save-business-profile-btn");

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

  const savedCampaigns = getCampaignHistory();

  campaignHistoryList.textContent = "";
  campaignHistoryEmpty.hidden = savedCampaigns.length > 0;

  savedCampaigns.forEach(function (savedCampaign, index) {

    const item = document.createElement("article");
    item.className = "campaign-history-item";

    const heading = document.createElement("h4");
    heading.textContent = savedCampaign.businessName || "Business name unavailable";

    const details = document.createElement("p");
    details.className = "campaign-history-details";
    details.textContent = `${savedCampaign.campaignType || "Campaign"} · ${new Date(savedCampaign.createdAt).toLocaleString()}`;

    const preview = document.createElement("p");
    preview.className = "campaign-history-preview";
    preview.textContent = savedCampaign.campaignText || "";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", function () {

      const campaign = getCampaignHistory()[index];

      if (!campaign) {
        return;
      }

      resultsContent.textContent = campaign.campaignText;
      resultsArea.hidden = false;
      copyBtn.hidden = false;
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });

    });

    item.append(heading, details, preview, openButton);
    campaignHistoryList.appendChild(item);

  });

}

function saveCampaign(campaignText, promoText, selectedCampaignType, profile) {

  const savedCampaigns = getCampaignHistory();

  savedCampaigns.unshift({
    campaignText: campaignText,
    campaignType: selectedCampaignType,
    promoText: promoText,
    businessName: profile.name,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem(
    campaignHistoryKey,
    JSON.stringify(savedCampaigns.slice(0, maximumSavedCampaigns))
  );

  renderCampaignHistory();

}

renderCampaignHistory();
const savedBusinessProfile = localStorage.getItem("demeosBusinessProfile");

if (savedBusinessProfile) {

  const businessProfile = JSON.parse(savedBusinessProfile);

  businessName.value = businessProfile.name || "";

  businessType.value = businessProfile.type || "";

  businessLocation.value = businessProfile.location || "";

  businessBrandVoice.value = businessProfile.brandVoice || "";
businessTargetCustomer.value = businessProfile.targetCustomer || "";
businessGoal.value = businessProfile.goal || "";
}
saveBusinessProfileBtn.addEventListener("click", function () {

  const businessProfile = {

    name: businessName.value.trim(),

    type: businessType.value.trim(),

    location: businessLocation.value.trim(),

    brandVoice: businessBrandVoice.value.trim(),

targetCustomer: businessTargetCustomer.value.trim(),
goal: businessGoal.value.trim()
  };

  if (!businessProfile.name || !businessProfile.type || !businessProfile.location || !businessProfile.brandVoice || !businessProfile.targetCustomer || !businessProfile.goal) {

  alert("Please complete all Business Manager Profile fields before saving.");

  return;

}
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

    try {

      const businessProfile = JSON.parse(
        localStorage.getItem("demeosBusinessProfile")
      );

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
        campaignType.options[campaignType.selectedIndex].text,
        businessProfile
      );

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
