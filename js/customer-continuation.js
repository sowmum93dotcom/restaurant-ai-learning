(function () {
  if (typeof document === "undefined") return;

  document.addEventListener("click", function (event) {
    const target = event.target && typeof event.target.closest === "function"
      ? event.target.closest(".customer-feedback-restart")
      : null;
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const intentionText = document.getElementById("customer-intention-text");
    const clarificationText = document.getElementById("customer-clarification-text");
    if (intentionText) intentionText.value = "";
    if (clarificationText) clarificationText.value = "";
    document.querySelectorAll(".customer-intention-option").forEach(function (option) {
      option.setAttribute("aria-pressed", "false");
    });

    const url = new URL(window.location.href);
    url.hash = "customer-intention-form";
    window.location.replace(url.toString());
  }, true);
}());
