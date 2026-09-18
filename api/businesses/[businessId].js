const { getRepository } = require("../_lib/persistence.js");
const {
  authorizeBusinessOwnerRequest
} = require("../_lib/demeos-business-owner-authorization.js");
const {
  resolveTrustedIdentityFromRequest
} = require("../_lib/demeos-authentication.js");
const { DEMEOS_ACTIONS } = require("../_lib/demeos-rules.js");

const ALLOWED_CONTINUATION_ROUTES = new Set(["website", "phone", "whatsapp", "email", "visit", "booking", "quote"]);
const ALLOWED_FULFILMENT_METHODS = new Set(["collection", "delivery", "shipping", "premises", "customer-location", "appointment", "digital"]);
const ALLOWED_AVAILABILITY_STATES = new Set(["available", "limited", "unavailable", "contact"]);
const MAX_PRODUCTS = 100;

function isSafeHttpUrl(value) {
  return /^https?:\/\//i.test(cleanString(value, 500));
}

function isPlausibleEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanString(value, 320));
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function getValidatedProfile(req) {
  const profile = req.body && req.body.businessProfile;
  const ownerAccuracyConfirmed = Boolean(req.body && req.body.ownerAccuracyConfirmed === true);
  const requiredFields = ["name", "type", "location", "brandVoice", "targetCustomer", "goal"];
  if (
    !profile ||
    typeof profile !== "object" ||
    Array.isArray(profile) ||
    requiredFields.some(function (field) {
      return typeof profile[field] !== "string" || !profile[field].trim();
    })
  ) return null;

  const enhancedProfile = Number(profile.profileVersion) >= 2;
  const continuation = profile.customerContinuation;
  const fulfilment = profile.fulfilment;
  const operational = profile.operationalAvailability;
  if (enhancedProfile && (
      !cleanString(profile.productsServices, 5000) ||
      !continuation || typeof continuation !== "object" || Array.isArray(continuation) ||
      !Array.isArray(continuation.routes) || !continuation.routes.length ||
      continuation.routes.some(function (route) { return !ALLOWED_CONTINUATION_ROUTES.has(route); }) ||
      !fulfilment || typeof fulfilment !== "object" || Array.isArray(fulfilment) ||
      !Array.isArray(fulfilment.methods) || !fulfilment.methods.length ||
      fulfilment.methods.some(function (method) { return !ALLOWED_FULFILMENT_METHODS.has(method); })
  )) return null;

  const requiredRouteDetails = { website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", booking: "bookingLink" };
  if (enhancedProfile && Object.keys(requiredRouteDetails).some(function (route) {
    return continuation.routes.includes(route) && !cleanString(continuation[requiredRouteDetails[route]], 500);
  })) return null;
  if (enhancedProfile && continuation.routes.includes("website") && !isSafeHttpUrl(continuation.website)) return null;
  if (enhancedProfile && continuation.routes.includes("booking") && !isSafeHttpUrl(continuation.bookingLink)) return null;
  if (enhancedProfile && continuation.routes.includes("email") && !isPlausibleEmail(continuation.email)) return null;
  if (enhancedProfile && continuation.routes.includes("quote") &&
      !continuation.routes.some(function (route) { return ["email", "phone", "whatsapp", "website", "booking"].includes(route); })) return null;
  const rawProducts = Array.isArray(profile.products) ? profile.products : [];
  if (rawProducts.length > MAX_PRODUCTS) return null;
  const products = [];
  const productIds = new Set();
  for (const item of rawProducts) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const productId = cleanString(item.productId, 120);
    const name = cleanString(item.name, 200);
    const description = cleanString(item.description, 1200);
    const price = cleanString(item.price, 100);
    const imageUrl = cleanString(item.imageUrl, 1000);
    const continuationRoute = cleanString(item.continuationRoute, 30);
    const availability = cleanString(item.availability, 30) || "contact";
    if (!productId || productIds.has(productId) || !name || !description ||
        (imageUrl && !isSafeHttpUrl(imageUrl)) ||
        (!continuationRoute || !ALLOWED_CONTINUATION_ROUTES.has(continuationRoute) || !continuation.routes.includes(continuationRoute)) ||
        !ALLOWED_AVAILABILITY_STATES.has(availability)) return null;
    productIds.add(productId);
    products.push({ productId, businessId: cleanString(profile.businessId, 120), name, description, price, imageUrl,
      continuationRoute, availability, imageSource: imageUrl ? "business-provided" : "" });
  }

  const operationalProfile = Number(profile.profileVersion) >= 3;
  if (operationalProfile && (!operational || typeof operational !== "object" || Array.isArray(operational) ||
      !ALLOWED_AVAILABILITY_STATES.has(operational.status))) return null;

  if (!enhancedProfile) return {
    ...profile,
    name: cleanString(profile.name, 200),
    type: cleanString(profile.type, 200),
    location: cleanString(profile.location, 300),
    brandVoice: cleanString(profile.brandVoice, 3000),
    targetCustomer: cleanString(profile.targetCustomer, 3000),
    goal: cleanString(profile.goal, 1000)
  };

  return {
    ...profile,
    name: cleanString(profile.name, 200),
    type: cleanString(profile.type, 200),
    location: cleanString(profile.location, 300),
    productsServices: cleanString(profile.productsServices, 5000),
    brandVoice: cleanString(profile.brandVoice, 3000),
    targetCustomer: cleanString(profile.targetCustomer, 3000),
    goal: cleanString(profile.goal, 1000),
    customerContinuation: {
      routes: Array.from(new Set(continuation.routes)),
      website: cleanString(continuation.website, 500),
      phone: cleanString(continuation.phone, 100),
      whatsapp: cleanString(continuation.whatsapp, 100),
      email: cleanString(continuation.email, 320),
      bookingLink: cleanString(continuation.bookingLink, 500)
    },
    fulfilment: {
      methods: Array.from(new Set(fulfilment.methods)),
      notes: cleanString(fulfilment.notes, 2000)
    },
    products,
    ...(operationalProfile ? {
      operationalAvailability: {
        status: operational.status,
        hoursNotes: cleanString(operational.hoursNotes, 2000),
        notes: cleanString(operational.notes, 2000)
      }
    } : {})
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  if (!businessId) return res.status(400).json({ error: "A businessId is required." });

  try {
    const repository = getRepository();
    const access = await authorizeBusinessOwnerRequest({
      req,
      businessId,
      action: req.method === "GET"
        ? DEMEOS_ACTIONS.VIEW_OWN_BUSINESS_RESULTS
        : DEMEOS_ACTIONS.MANAGE_BUSINESS_PROFILE,
      repository
    });
    if (!access.authenticated) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (req.method === "PUT") {
      const profile = getValidatedProfile(req);
      if (!profile) {
        return res.status(400).json({
          error: "Please complete all Business Manager Profile fields before saving."
        });
      }

      if (access.allowed) {
        if (Number(profile.profileVersion) >= 3 && !ownerAccuracyConfirmed) {
          return res.status(400).json({ error: "Please explicitly confirm that the Business Profile information is current before saving." });
        }
        const existingBusiness = await repository.getKnownBusiness(businessId);
        const previousInformationStatus = existingBusiness && existingBusiness.informationStatus && typeof existingBusiness.informationStatus === "object"
          ? existingBusiness.informationStatus : {};
        await repository.saveBusiness({
          ...profile,
          businessId,
          products: (profile.products || []).map(function (product) { return { ...product, businessId }; }),
          informationStatus: {
            ...previousInformationStatus,
            source: "business-owner",
            status: "business-provided",
            ownerConfirmedAt: ownerAccuracyConfirmed ? new Date().toISOString() : previousInformationStatus.ownerConfirmedAt
          }
        });
        return res.status(204).end();
      }

      // A signed-in user may create a brand-new business and become its first owner,
      // but may never claim or overwrite an existing business they do not own.
      const trustedIdentity = await resolveTrustedIdentityFromRequest(req);
      if (!trustedIdentity) {
        return res.status(401).json({ error: "Authentication required." });
      }
      if (Number(profile.profileVersion) >= 3 && !ownerAccuracyConfirmed) {
        return res.status(400).json({ error: "Please explicitly confirm that the Business Profile information is current before saving." });
      }
      const created = await repository.createBusinessForOwner(
        trustedIdentity.trustedIdentityId,
        {
          ...profile,
          businessId,
          products: (profile.products || []).map(function (product) { return { ...product, businessId }; }),
          informationStatus: {
            source: "business-owner",
            status: "business-provided",
            ownerConfirmedAt: new Date().toISOString()
          }
        }
      );
      if (!created) return res.status(403).json({ error: "Forbidden." });
      return res.status(204).end();
    }

    if (!access.allowed) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const record = await repository.getKnownBusiness(businessId);
    if (!record) return res.status(404).json({ error: "Business not found." });
    return res.status(200).json(record);
  } catch (error) {
    console.error("Could not restore known business:", error);
    return res.status(500).json({ error: "DEMEOS could not restore this business." });
  }
};
