const MEDIA_ASSET_KINDS = Object.freeze(["image", "video"]);
const MEDIA_ASSET_STATES = Object.freeze(["pending-upload", "processing", "ready", "failed", "archived"]);
function normalizeText(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function isHttpsUrl(value) { const normalized = normalizeText(value); return Boolean(normalized && /^https:\/\//i.test(normalized)); }
function normalizeMediaAsset(asset, businessId) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) return null;
  const assetId = normalizeText(asset.assetId), ownerBusinessId = normalizeText(asset.businessId);
  const kind = normalizeText(asset.kind), state = normalizeText(asset.state);
  if (!assetId || !ownerBusinessId || ownerBusinessId !== businessId || !MEDIA_ASSET_KINDS.includes(kind) || !MEDIA_ASSET_STATES.includes(state)) return null;
  const normalized = { assetId, businessId: ownerBusinessId, kind, state };
  const contentType = normalizeText(asset.contentType); if (contentType) normalized.contentType = contentType;
  const deliveryUrl = normalizeText(asset.deliveryUrl);
  if (deliveryUrl) { if (!isHttpsUrl(deliveryUrl)) return null; normalized.deliveryUrl = deliveryUrl; }
  const createdAt = normalizeText(asset.createdAt); if (createdAt) normalized.createdAt = createdAt;
  return normalized;
}
function toPublicMediaAsset(asset, businessId) {
  const normalized = normalizeMediaAsset(asset, businessId);
  if (!normalized || normalized.state !== "ready" || !normalized.deliveryUrl) return null;
  return { assetId: normalized.assetId, kind: normalized.kind, deliveryUrl: normalized.deliveryUrl, ...(normalized.contentType ? { contentType: normalized.contentType } : {}) };
}
module.exports = { MEDIA_ASSET_KINDS, MEDIA_ASSET_STATES, normalizeMediaAsset, toPublicMediaAsset };
