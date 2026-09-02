document.addEventListener("DOMContentLoaded", function () {

  const generateBtn = document.getElementById("generate-btn");

  const promoInput = document.getElementById("promo-input");
  const campaignType = document.getElementById("campaign-type");

  const resultsArea = document.getElementById("results");

  const resultsContent = document.getElementById("results-content");
  const copyBtn = document.getElementById("copy-btn");
const businessName = document.getElementById("business-name");

const businessType = document.getElementById("business-type");
const businessTargetCustomer = document.getElementById("business-target-customer");
const businessGoal = document.getElementById("business-goal");
const businessLocation = document.getElementById("business-location");

const businessBrandVoice = document.getElementById("business-brand-voice");

const saveBusinessProfileBtn = document.getElementById("save-business-profile-btn");
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

  if (!businessProfile.name || !businessProfile.type || !businessProfile.location || !businessProfile.targetCustomer || !businessProfile.goal) {

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

    try {

      const response = await fetch("/api/generate", {

        method: "POST",

        headers: {

          "Content-Type": "application/json"

        },
          

        body: JSON.stringify({

  promoText: promoText,

campaignType: campaignType.value,

businessProfile: JSON.parse(

  localStorage.getItem("demeosBusinessProfile")

)
            })

    });

      const data = await response.json();

      if (!response.ok) {

        throw new Error(data.error || "DEMEOS could not generate your marketing work.");

      }

      resultsContent.textContent = data.campaign;
      copyBtn.hidden = false;

      resultsArea.scrollIntoView({

        behavior: "smooth",

        block: "start"

      });

    } catch (error) {

      console.error(error);

      resultsContent.textContent =

       "Sorry, the DEMEOS Marketing Agent could not generate the marketing work right now.";

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