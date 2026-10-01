(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CustomerUnderstanding = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const intentionPhrases = Object.freeze({
    "Eat & enjoy": "eat and enjoy",
    "Take care of myself": "take care of yourself",
    "Spend time together": "spend time together",
    "Get something done": "get something done",
    "Go somewhere": "go somewhere",
    "Discover something new": "discover something new"
  });
  const clarificationIntentions = new Set(["Get something done"]);

  function normalizeCustomerText(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/\s+/g, " ");
  }

  function sentenceText(value) {
    const text = normalizeCustomerText(value).replace(/[.!?]+$/, "");
    return text ? text.charAt(0).toLowerCase() + text.slice(1) : "";
  }

  function detailPhrase(value) {
    return sentenceText(value)
      .replace(/^(?:i\s+(?:would|'d)\s+like|i\s+want)\s+/i, "")
      .replace(/\bmy\b/gi, "your");
  }

  function buildCustomerUnderstanding(intention, customerText, clarificationText) {
    const selected = Object.hasOwn(intentionPhrases, intention) ? intention : "";
    const originalText = normalizeCustomerText(customerText);
    const clarification = normalizeCustomerText(clarificationText);
    if (!selected && !originalText) return null;

    const detail = detailPhrase(clarification || originalText);
    let understanding;
    if (selected && detail) understanding = `You’d like to ${intentionPhrases[selected]} and are looking for ${detail}.`;
    else if (selected) understanding = `You’d like to ${intentionPhrases[selected]}.`;
    else understanding = `You told DEMEOS: “${originalText}”`;

    return Object.freeze({
      intention: selected,
      customerText: clarification || originalText,
      understanding,
      source: "customer-provided",
      confidenceState: clarificationIntentions.has(selected) && !detail ? "needs-clarification" : "ready-for-confirmation"
    });
  }

  function confirmCustomerUnderstanding(understanding) {
    if (!understanding || understanding.confidenceState !== "ready-for-confirmation") return null;
    return Object.freeze({ ...understanding, confidenceState: "confirmed" });
  }

  return { buildCustomerUnderstanding, confirmCustomerUnderstanding, normalizeCustomerText };
}));

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  const emptyState = document.getElementById("customer-no-possibilities");
  if (!emptyState || document.getElementById("customer-no-possibilities-actions")) return;

  const actions = document.createElement("div");
  actions.id = "customer-no-possibilities-actions";
  actions.className = "customer-no-possibilities-actions";

  const addDetail = document.createElement("button");
  addDetail.id = "customer-add-detail";
  addDetail.type = "button";
  addDetail.textContent = "Add more detail";

  const change = document.createElement("button");
  change.id = "customer-empty-change-intention";
  change.type = "button";
  change.textContent = "Change what I’m looking for";

  actions.append(addDetail, change);

  const form = document.createElement("form");
  form.id = "customer-add-detail-form";
  form.className = "customer-add-detail-form";
  form.hidden = true;

  const label = document.createElement("label");
  label.htmlFor = "customer-add-detail-text";
  label.textContent = "Add a little more detail";

  const input = document.createElement("textarea");
  input.id = "customer-add-detail-text";
  input.rows = 3;
  input.maxLength = 500;
  input.setAttribute("dir", "auto");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Continue";

  const cancel = document.createElement("button");
  cancel.id = "customer-add-detail-cancel";
  cancel.type = "button";
  cancel.textContent = "Cancel";

  const status = document.createElement("p");
  status.id = "customer-add-detail-status";
  status.setAttribute("aria-live", "polite");

  form.append(label, input, submit, cancel, status);
  emptyState.append(actions, form);
});
