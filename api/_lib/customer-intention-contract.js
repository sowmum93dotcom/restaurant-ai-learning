const INTENTIONS = Object.freeze([
  "Eat & enjoy", "Take care of myself", "Spend time together",
  "Get something done", "Go somewhere", "Discover something new"
]);
const ALLOWED_KEYS = Object.freeze(["intention", "customerText", "understanding"]);

function cleanText(value, maximum, required) {
  if (value === undefined && !required) return "";
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  if ((required && !clean) || clean.length > maximum || /<\/?[a-z][^>]*>/i.test(clean)) return null;
  return clean;
}

function validateCustomerIntention(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(function (key) { return !ALLOWED_KEYS.includes(key); })) return null;
  const intention = cleanText(body.intention, 80, true);
  const customerText = cleanText(body.customerText, 500, false);
  const understanding = cleanText(body.understanding, 750, true);
  if (!intention || !INTENTIONS.includes(intention) || customerText === null || !understanding) return null;
  return Object.freeze({ intention, customerText, understanding,
    evidenceType: "customer-confirmed-intention", source: "authenticated-customer", confirmationState: "confirmed" });
}

module.exports = { INTENTIONS, ALLOWED_KEYS, validateCustomerIntention };
