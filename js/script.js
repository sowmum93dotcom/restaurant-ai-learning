// This is a placeholder "AI" — it does not call any external service.
// It simply builds a sample marketing campaign from the text the user enters.
// A real AI integration can replace this function later.

document.addEventListener("DOMContentLoaded", function () {
  const generateBtn = document.getElementById("generate-btn");
  const promoInput = document.getElementById("promo-input");
  const resultsArea = document.getElementById("results");
  const resultsContent = document.getElementById("results-content");

  generateBtn.addEventListener("click", function () {
    const promoText = promoInput.value.trim();

    if (promoText === "") {
      alert("Please describe what you'd like to promote first.");
      return;
    }

    const campaign = buildSampleCampaign(promoText);
    resultsContent.textContent = campaign;
    resultsArea.hidden = false;
    resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function buildSampleCampaign(promoText) {
    return (
      "Social Media Post:\n" +
      '"' + promoText + ' Come taste it for yourself — book your table today!"\n\n' +
      "Email Subject Line:\n" +
      "You won't want to miss this...\n\n" +
      "Short Ad Copy:\n" +
      promoText + " Limited time only. Visit us or order online!\n\n" +
      "(This is a sample campaign generated from your description. " +
      "Real AI-generated content will be added in a future version.)"
    );
  }
});
