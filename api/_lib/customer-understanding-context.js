const { buildCustomerUnderstanding } = require("../../js/customer-understanding.js");

const ALLOWED_KEYS = Object.freeze(["intention", "customerText", "clarificationText"]);

function cleanText(value, maximum) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length > maximum || /<\/?[a-z][^>]*>/i.test(clean)) return null;
  return clean;
}

function buildTrustedCustomerUnderstanding(body, storedPreferences, storedFeedback) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(function (key) { return !ALLOWED_KEYS.includes(key); })) return null;
  const intention = cleanText(body.intention, 80);
  const customerText = cleanText(body.customerText, 500);
  const clarificationText = cleanText(body.clarificationText, 500);
  if (intention === null || customerText === null || clarificationText === null) return null;
  const current = buildCustomerUnderstanding(intention, customerText, clarificationText);
  if (!current) return null;

  // Preferences stay separate from the current intention: they are optional guidance,
  // never facts about a business and never inputs from any other evidence stream.
  const preferenceEvidence = (Array.isArray(storedPreferences) ? storedPreferences : []).slice(0, 50)
    .filter(function (item) { return item && typeof item.preference === "string" && item.preference.trim(); })
    .map(function (item) { return Object.freeze({
      value: item.preference.trim(), evidenceType: "customer-explicit-preference",
      source: "authenticated-customer", role: "guidance-not-requirement"
    }); });
  // Feedback is retained as its own relevance-learning stream. It cannot alter
  // the confirmed current intention or become preference or outcome evidence.
  const feedbackEvidence = (Array.isArray(storedFeedback) ? storedFeedback : []).slice(0, 50)
    .filter(function (item) {
      return item && ["Relevant", "Not quite", "Something different"].includes(item.response) &&
        typeof item.possibilityContent === "string" && item.possibilityContent.trim();
    }).map(function (item) { return Object.freeze({
      response: item.response, possibilityContent: item.possibilityContent.trim(),
      evidenceType: "customer-feedback", source: "authenticated-customer", role: "relevance-learning-only"
    }); });
  return Object.freeze({
    ...current,
    preferenceContext: Object.freeze({
      evidence: Object.freeze(preferenceEvidence), authority: "current-intention-primary"
    }),
    feedbackContext: Object.freeze({
      evidence: Object.freeze(feedbackEvidence), authority: "current-intention-primary",
      meaning: "possibility-relevance-only"
    })
  });
}

module.exports = { ALLOWED_KEYS, buildTrustedCustomerUnderstanding };
