document.addEventListener("DOMContentLoaded", function () {

  const generateBtn = document.getElementById("generate-btn");

  const promoInput = document.getElementById("promo-input");
  const campaignType = document.getElementById("campaign-type");

  const resultsArea = document.getElementById("results");

  const resultsContent = document.getElementById("results-content");
  const copyBtn = document.getElementById("copy-btn");
const businessName = document.getElementById("business-name");

const businessType = document.getElementById("business-type");

const businessLocation = document.getElementById("business-location");

const businessBrandVoice = document.getElementById("business-brand-voice");

const saveBusinessProfileBtn = document.getElementById("save-business-profile-btn");
  generateBtn.addEventListener("click", async function () {

    const promoText = promoInput.value.trim();

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

  campaignType: campaignType.value
})
      });

      const data = await response.json();

      if (!response.ok) {

        throw new Error(data.error || "The AI service could not generate the campaign.");

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