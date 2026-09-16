const crypto = require("node:crypto");
const { buildCustomerUnderstanding } = require("../../js/customer-understanding.js");
const { getValidPublicCustomerWork } = require("./customer-public-work-contract.js");

const SUPPORTED_INTENTIONS = Object.freeze([
  "Eat & enjoy", "Take care of myself", "Spend time together",
  "Get something done", "Go somewhere", "Discover something new"
]);
const MAX_POSSIBILITIES = 5;
const FIELD_LIMITS = Object.freeze({ intention: 40, customerText: 500, understanding: 700 });
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "our", "but", "not",
  "have", "has", "had", "was", "were", "would", "could", "should", "into", "onto", "about", "there",
  "here", "today", "tomorrow", "want", "wants", "wanted", "like", "need", "needs", "needed", "looking",
  "business", "businesses", "customer", "customers", "something", "somewhere", "myself", "my", "me", "we",
  "they", "their", "them", "its", "get", "getting", "make", "take", "use", "using", "enjoy", "discover"
]);

function ownKeysAre(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every(function (key, index) { return key === keys[index]; });
}

function validateConfirmedUnderstanding(body) {
  if (!ownKeysAre(body, ["understanding"])) return null;
  const value = body.understanding;
  const keys = ["confidenceState", "customerText", "intention", "source", "understanding"].sort();
  if (!ownKeysAre(value, keys)) return null;
  if (value.source !== "customer-provided" || value.confidenceState !== "confirmed") return null;
  if (typeof value.intention !== "string" || typeof value.customerText !== "string" ||
      typeof value.understanding !== "string") return null;
  if (value.intention.length > FIELD_LIMITS.intention || value.customerText.length > FIELD_LIMITS.customerText ||
      value.understanding.length > FIELD_LIMITS.understanding) return null;
  const intention = value.intention.trim();
  const customerText = value.customerText.trim().replace(/\s+/g, " ");
  const understanding = value.understanding.trim();
  if (value.intention !== intention || value.customerText !== customerText || value.understanding !== understanding) return null;
  if (intention && !SUPPORTED_INTENTIONS.includes(intention)) return null;
  if (!intention && !customerText) return null;
  if (!understanding) return null;

  const expected = buildCustomerUnderstanding(intention, customerText);
  if (!expected || expected.confidenceState !== "ready-for-confirmation" || expected.understanding !== understanding) return null;
  return Object.freeze({ intention, customerText, understanding, source: value.source, confidenceState: value.confidenceState });
}

function meaningfulTerms(value) {
  const matches = String(value || "").toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) || [];
  return new Set(matches.filter(function (term) { return term.length >= 3 && !STOP_WORDS.has(term); }));
}

function preferenceTerms(storedPreferences) {
  const values = (Array.isArray(storedPreferences) ? storedPreferences : []).slice(0, 50)
    .filter(function (item) { return item && typeof item.preference === "string"; })
    .map(function (item) { return item.preference; });
  return meaningfulTerms(values.join(" "));
}

function stablePossibilityId(workItemId) {
  return "possibility_" + crypto.createHash("sha256").update("demeos-customer-possibility:" + workItemId)
    .digest("base64url").slice(0, 20);
}

function findCustomerPossibilities(understanding, repositoryWork, limit = MAX_POSSIBILITIES, storedPreferences = []) {
  const customerTerms = meaningfulTerms([understanding.intention, understanding.customerText].join(" "));
  const guidanceTerms = preferenceTerms(storedPreferences);
  const candidates = [];
  getValidPublicCustomerWork(repositoryWork).forEach(function (work) {
    const contentTerms = meaningfulTerms(work.content);
    const evidence = Array.from(customerTerms).filter(function (term) { return contentTerms.has(term); }).sort();
    if (evidence.length < 2) return;
    const guidanceOverlap = Array.from(guidanceTerms).filter(function (term) { return contentTerms.has(term); }).length;
    const possibility = {
      possibilityId: stablePossibilityId(work.workItemId), workItemId: work.workItemId,
      businessName: work.businessName, content: work.content, participationAction: "Interested",
      relevance: { basis: "explicit-customer-intent-overlap", evidence: evidence.slice(0, 5) }
    };
    if (work.location) possibility.location = work.location;
    candidates.push({ strength: evidence.length, guidanceOverlap, possibility });
  });
  candidates.sort(function (left, right) {
    return right.strength - left.strength || right.guidanceOverlap - left.guidanceOverlap ||
      left.possibility.workItemId.localeCompare(right.possibility.workItemId);
  });
  return candidates.slice(0, Math.min(MAX_POSSIBILITIES, Math.max(0, limit))).map(function (item) { return item.possibility; });
}

module.exports = {
  FIELD_LIMITS, MAX_POSSIBILITIES, SUPPORTED_INTENTIONS, findCustomerPossibilities,
  meaningfulTerms, preferenceTerms, stablePossibilityId, validateConfirmedUnderstanding
};