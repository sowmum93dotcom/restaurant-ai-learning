const CUSTOMER_PARTICIPATION_ACTION = "Interested";

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
