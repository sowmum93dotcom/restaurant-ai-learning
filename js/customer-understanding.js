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
