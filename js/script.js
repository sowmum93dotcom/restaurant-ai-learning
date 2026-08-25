document.addEventListener("DOMContentLoaded", function () {

  const generateBtn = document.getElementById("generate-btn");

  const promoInput = document.getElementById("promo-input");

  const resultsArea = document.getElementById("results");

  const resultsContent = document.getElementById("results-content");

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

      const response = await fetch("/api/api/generate", {

        method: "POST",

        headers: {

          "Content-Type": "application/json"

        },

        body: JSON.stringify({

          promoText: promoText

        })

      });

      const data = await response.json();

      if (!response.ok) {

        throw new Error(data.error || "The AI service could not generate the campaign.");

      }

      resultsContent.textContent = data.campaign;

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

});