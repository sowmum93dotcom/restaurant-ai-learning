const customerItemContract = require("../../js/customer-item-contract.js");
const MAX_PUBLIC_CUSTOMER_MEDIA = 10;
const DEFAULT_PUBLIC_CUSTOMER_WORK_LIMIT = 20;
const CUSTOMER_PARTICIPATION_ACTION = "Interested";
const ALLOWED_CONTINUATION_ROUTES = new Set(["website", "phone", "whatsapp", "email", "visit", "booking", "quote", "demeos"]);
const ALLOWED_FULFILMENT_METHODS = new Set(["collection", "delivery", "shipping", "premises", "customer-location", "appointment", "digital"]);
const ROUTE_DETAIL_FIELDS = Object.freeze({ website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", booking: "bookingLink", visit: "visitAddress" });

function normalizedRequiredString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

// IDs are continuation authority. Reject every occurrence of an ambiguous ID,
// including malformed siblings, rather than choosing a first/last record.
function duplicateIdentifiers(records, field) {
  const seen = new Set(), duplicates = new Set();
  for (const record of records) {
    const id = normalizedRequiredString(record && record[field]);
    if (!id) continue;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return duplicates;
}

function toPublicCustomerWorkItem(item, {forSearchClassification = false} = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const workItemId = normalizedRequiredString(item.workItemId);
  const businessName = normalizedRequiredString(item.businessName);
  const content = normalizedRequiredString(item.content);
  if (!workItemId || !businessName || !content || item.participationAction !== CUSTOMER_PARTICIPATION_ACTION) {
    return null;
  }

  const businessId = normalizedRequiredString(item.businessId);
  const publicItem = { workItemId, businessName, content, participationAction: CUSTOMER_PARTICIPATION_ACTION };
  if (typeof item.location === "string" && item.location.trim()) publicItem.location = item.location.trim();

  const continuation = item.customerContinuation;
  if (continuation && typeof continuation === "object" && !Array.isArray(continuation) && Array.isArray(continuation.routes)) {
    const routes = continuation.routes.filter(function (route) { return ALLOWED_CONTINUATION_ROUTES.has(route); });
    const safeContinuation = { routes: [] };
    routes.forEach(function (route) {
      const detailField = ROUTE_DETAIL_FIELDS[route];
      if (detailField) {
        const detail = normalizedRequiredString(continuation[detailField]);
        if (!detail) return;
        if ((route === "website" || route === "booking") && !/^https?:\/\//i.test(detail)) return;
        if (route === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detail)) return;
        if ((route === "phone" || route === "whatsapp") && !/^\+?[0-9][0-9 ()-]{6,24}$/.test(detail)) return;
        if ((route === "phone" || route === "whatsapp") && (detail.replace(/\D/g, "").length < 7 || detail.replace(/\D/g, "").length > 15)) return;
        safeContinuation[detailField] = detail;
      }
      safeContinuation.routes.push(route);
    });
    if (safeContinuation.routes.includes("quote")) {
      const fallbackRoute = ["email", "phone", "whatsapp", "website", "booking"].find(function (route) { return safeContinuation.routes.includes(route); });
      if (fallbackRoute) safeContinuation.quoteVia = fallbackRoute;
      else safeContinuation.routes = safeContinuation.routes.filter(function (route) { return route !== "quote"; });
    }
    if (safeContinuation.routes.length) publicItem.customerContinuation = safeContinuation;
  }

  const fulfilment = item.fulfilment;
  if (fulfilment && typeof fulfilment === "object" && !Array.isArray(fulfilment) && Array.isArray(fulfilment.methods)) {
    const methods = fulfilment.methods.filter(function (method) { return ALLOWED_FULFILMENT_METHODS.has(method); });
    if (methods.length) {
      publicItem.fulfilment = { methods };
      const notes = normalizedRequiredString(fulfilment.notes);
      if (notes) publicItem.fulfilment.notes = notes;
    }
  }
  if (Array.isArray(item.products)) {
    const duplicateProductIds = duplicateIdentifiers(item.products, "productId");
    const products = item.products.filter(function (product) {
      return product && typeof product === "object" && !Array.isArray(product) && product.customerVisible !== false &&
        !duplicateProductIds.has(normalizedRequiredString(product.productId)) &&
        normalizedRequiredString(product.productId) && normalizedRequiredString(product.name) &&
        normalizedRequiredString(product.description) &&
        (!product.imageUrl || /^https?:\/\//i.test(product.imageUrl)) &&
        businessId && normalizedRequiredString(product.businessId) === businessId;
    }).slice(0, 100).map(function (product) {
      const route = normalizedRequiredString(product.continuationRoute);
      const safeRoute = route && publicItem.customerContinuation &&
        publicItem.customerContinuation.routes.includes(route) ? route : null;
      if (!safeRoute) return null;
      const presentation = product.presentation === undefined ? undefined : customerItemContract.normalize(product.presentation);
      if (product.presentation !== undefined && !presentation) return null;
      const categoryClassification = require('./customer-category-classification').validateClassification(product.categoryClassification, product.name.trim() + ' ' + product.description.trim());
      return {
        ...(forSearchClassification && categoryClassification ? {categoryClassification} : {}),
        ...(presentation ? { presentation } : {}),
        productId: product.productId.trim(),
        name: product.name.trim(),
        description: product.description.trim(),
        ...(normalizedRequiredString(product.price) ? { price: product.price.trim() } : {}),
        ...(["fixed", "from", "range"].includes(product.priceMode) ? { priceMode: product.priceMode } : { priceMode: normalizedRequiredString(product.price) ? "fixed" : "contact" }),
        ...(normalizedRequiredString(product.imageUrl) ? { imageUrl: product.imageUrl.trim(), imageSource: "business-provided" } : {}),
        ...(safeRoute ? { continuationRoute: safeRoute } : {}),
        availability: ["available", "limited", "unavailable", "contact"].includes(product.availability) ? product.availability : "contact",
        ...(product.fulfilment && Array.isArray(product.fulfilment.methods) ? { fulfilment: { methods: product.fulfilment.methods.filter(function (method) { return ALLOWED_FULFILMENT_METHODS.has(method); }), ...(Array.isArray(product.fulfilment.requiredDetails)?{requiredDetails:product.fulfilment.requiredDetails.filter(k=>['recipient','address','city','postalCode','country','date','location','people'].includes(k))}:{}), ...(typeof product.fulfilment.quantityEnabled==='boolean'?{quantityEnabled:product.fulfilment.quantityEnabled}:{}) } } : {})
      };
    }).filter(Boolean);
    if (products.length) publicItem.products = products;
    if (forSearchClassification) {
      const categoryClassification = require('./customer-category-classification').classificationFromProducts(products);
      if (categoryClassification) publicItem.categoryClassification = categoryClassification;
    }
  }

  if (Array.isArray(item.media)) {
    const media = item.media.filter(function (asset) {
      return asset && typeof asset === "object" && ["image", "video"].includes(asset.kind) &&
        ["primary", "supporting"].includes(asset.role) && /^https:\/\//i.test(asset.deliveryUrl || "");
    }).slice(0, MAX_PUBLIC_CUSTOMER_MEDIA).map(function (asset) {
      return { assetId: asset.assetId, kind: asset.kind, role: asset.role, deliveryUrl: asset.deliveryUrl,
        ...(asset.contentType ? { contentType: asset.contentType } : {}),
        ...(asset.kind === "video" && asset.fallbackSource && asset.fallbackSource.contentType === "video/webm" && /^https:\/\//i.test(asset.fallbackSource.deliveryUrl || "") ? { fallbackSource: { deliveryUrl: asset.fallbackSource.deliveryUrl, contentType: "video/webm" } } : {}),
        ...(normalizedRequiredString(asset.purpose) ? { purpose: asset.purpose.trim() } : {}),
        ...(normalizedRequiredString(asset.relatedEntityId) ? { relatedEntityId: asset.relatedEntityId.trim() } : {}) };
    });
    if (media.length) publicItem.media = media;
  }

  const operational = item.operationalAvailability;
  if (operational && typeof operational === "object" && ["available", "limited", "unavailable", "contact"].includes(operational.status)) {
    publicItem.operationalAvailability = {
      status: operational.status,
      hoursNotes: normalizedRequiredString(operational.hoursNotes) || "",
      notes: normalizedRequiredString(operational.notes) || ""
    };
  }
  if (item.informationSource === "business-provided") publicItem.informationSource = "business-provided";
  return publicItem;
}

function getValidPublicCustomerWork(work, limit = DEFAULT_PUBLIC_CUSTOMER_WORK_LIMIT, options = {}) {
  if (!Array.isArray(work)) return [];
  const duplicateWorkIds = duplicateIdentifiers(work, "workItemId");
  const validWork = [];
  const deferredByBusiness = new Map();
  const firstBusinessPass = new Set();
  for (const item of work) {
    if (duplicateWorkIds.has(normalizedRequiredString(item && item.workItemId))) continue;
    const publicItem = toPublicCustomerWorkItem(item, options);
    if (!publicItem) continue;
    const businessKey = normalizedRequiredString(item.businessId) || `work:${publicItem.workItemId}`;
    if (!firstBusinessPass.has(businessKey)) {
      firstBusinessPass.add(businessKey);
      validWork.push(publicItem);
    } else {
      const deferred = deferredByBusiness.get(businessKey) || [];
      deferred.push(publicItem);
      deferredByBusiness.set(businessKey, deferred);
    }
    if (validWork.length === limit) return validWork;
  }
  for (const deferred of deferredByBusiness.values()) {
    for (const publicItem of deferred) {
      validWork.push(publicItem);
      if (validWork.length === limit) return validWork;
    }
  }
  return validWork;
}

module.exports = {
  MAX_PUBLIC_CUSTOMER_MEDIA,
  DEFAULT_PUBLIC_CUSTOMER_WORK_LIMIT,
  CUSTOMER_PARTICIPATION_ACTION,
  getValidPublicCustomerWork,
  toPublicCustomerWorkItem
};
