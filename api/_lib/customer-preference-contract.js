const ALLOWED_KEYS = Object.freeze(["preference"]);

function validateCustomerPreference(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(function (key) { return !ALLOWED_KEYS.includes(key); }) ||
      typeof body.preference !== "string") return null;
  const preference = body.preference.trim().replace(/\s+/g, " ");
  if (!preference || preference.length > 200 || /<\/?[a-z][^>]*>/i.test(preference)) return null;
  return Object.freeze({ preference, evidenceType: "customer-explicit-preference",
    source: "authenticated-customer", confirmationState: "confirmed" });
}

module.exports = { ALLOWED_KEYS, validateCustomerPreference };
