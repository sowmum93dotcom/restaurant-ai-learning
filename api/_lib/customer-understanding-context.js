const { buildCustomerUnderstanding } = require("../../js/customer-understanding.js");

const ALLOWED_KEYS = Object.freeze(["intention", "customerText", "clarificationText"]);

function cleanText(value, maximum) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length > maximum || /<\/?[a-z][^>]*>/i.test(clean)) return null;
  return clean;
}

function buildTrustedCustomerUnderstanding(body, storedPreferences) {
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
  return Object.freeze({
    ...current,
    preferenceContext: Object.freeze({
      evidence: Object.freeze(preferenceEvidence), authority: "current-intention-primary"
    })
  });
}

module.exports = { ALLOWED_KEYS, buildTrustedCustomerUnderstanding };
