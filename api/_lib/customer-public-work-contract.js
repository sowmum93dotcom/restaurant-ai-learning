const CUSTOMER_PARTICIPATION_ACTION = "Interested";
const ALLOWED_CONTINUATION_ROUTES = new Set(["website", "phone", "whatsapp", "email", "visit", "booking", "quote"]);
const ALLOWED_FULFILMENT_METHODS = new Set(["collection", "delivery", "shipping", "premises", "customer-location", "appointment", "digital"]);
const ROUTE_DETAIL_FIELDS = Object.freeze({ website: "website", phone: "phone", whatsapp: "whatsapp", email: "email", booking: "bookingLink" });

function normalizedRequiredString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function toPublicCustomerWorkItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const workItemId = normalizedRequiredString(item.workItemId);
  const businessName = normalizedRequiredString(item.businessName);
  const content = normalizedRequiredString(item.content);
  if (!workItemId || !businessName || !content || item.participationAction !== CUSTOMER_PARTICIPATION_ACTION) {
    return null;
  }

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
  if (item.informationSource === "business-provided") publicItem.informationSource = "business-provided";
  return publicItem;
}

function getValidPublicCustomerWork(work, limit = 20) {
  if (!Array.isArray(work)) return [];
  const validWork = [];
  for (const item of work) {
    const publicItem = toPublicCustomerWorkItem(item);
    if (publicItem) validWork.push(publicItem);
    if (validWork.length === limit) break;
  }
  return validWork;
}

module.exports = {
  CUSTOMER_PARTICIPATION_ACTION,
  getValidPublicCustomerWork,
  toPublicCustomerWorkItem
};
