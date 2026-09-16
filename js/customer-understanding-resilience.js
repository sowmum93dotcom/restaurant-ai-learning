(function () {
  function renderLocalUnderstanding(document, clarificationText) {
    if (!globalThis.CustomerUnderstanding || typeof globalThis.CustomerUnderstanding.buildCustomerUnderstanding !== "function") return;
    const selected = Array.from(document.querySelectorAll("#customer-intention-options .customer-intention-option"))
      .find(function (button) { return button.getAttribute("aria-pressed") === "true"; });
    const intention = selected ? selected.textContent : "";
    const customerText = document.getElementById("customer-intention-text")?.value || "";
    const local = globalThis.CustomerUnderstanding.buildCustomerUnderstanding(intention, customerText, clarificationText || "");
    if (!local) return;
    const panel = document.getElementById("customer-understanding");
    const form = document.getElementById("customer-intention-form");
    const summary = document.getElementById("customer-understanding-summary");
    const clarification = document.getElementById("customer-clarification");
    const actions = document.getElementById("customer-understanding-actions");
    const confirm = document.getElementById("customer-understanding-confirm");
    const status = document.getElementById("customer-understanding-status");
    const heading = document.getElementById("customer-understanding-heading");
    if (!panel || !form || !summary || !clarification || !actions || !confirm || !status) return;
    summary.textContent = local.understanding;
    const needsClarification = local.confidenceState === "needs-clarification";
    clarification.hidden = !needsClarification;
    actions.hidden = needsClarification;
    confirm.hidden = false;
    status.textContent = needsClarification ? "Add a little more detail so DEMEOS can understand your intention." : "";
    form.hidden = true;
    panel.hidden = false;
    if (heading && typeof heading.focus === "function") heading.focus();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("customer-intention-form");
    const clarificationButton = document.getElementById("customer-clarification-button");
    if (form) form.addEventListener("submit", function () { renderLocalUnderstanding(document, ""); }, true);
    if (clarificationButton) clarificationButton.addEventListener("click", function () {
      renderLocalUnderstanding(document, document.getElementById("customer-clarification-text")?.value || "");
    }, true);
  });
})();
