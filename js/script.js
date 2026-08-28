document.addEventListener("DOMContentLoaded", function () {

  const generateBtn = document.getElementById("generate-btn");

  const promoInput = document.getElementById("promo-input");
  const campaignType = document.getElementById("campaign-type");

  const resultsArea = document.getElementById("results");

  const resultsContent = document.getElementById("results-content");
  const copyBtn = document.getElementById("copy-btn");

  generateBtn.addEventListener("click", async function () {

    const promoText = promoInput.value.trim();

    if (!promoText) {

      alert("Please describe what you'd like to promote first.");

      return;

    }

    generateBtn.disabled = true;

    generateBtn.textContent = "Generating...";

    resultsArea.hidden = false;

    resultsContent.textContent = "Creating your marketing campaign...";

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

        "Sorry, the AI Marketing Assistant could not generate a campaign right now. Please try again.";

    } finally {

      generateBtn.disabled = false;

      generateBtn.textContent = "Generate Marketing Campaign";

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