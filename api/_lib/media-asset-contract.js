const MEDIA_ASSET_KINDS = Object.freeze(["image", "video"]);
const MEDIA_ASSET_STATES = Object.freeze(["pending-upload", "processing", "ready", "failed", "archived"]);
const MEDIA_ASSET_PURPOSES = Object.freeze(["brand", "product", "service", "marketing"]);
const IMAGE_CONTENT_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_CONTENT_TYPES = Object.freeze(["video/mp4", "video/quicktime"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 60;
const RECOMMENDED_VIDEO_DURATION_SECONDS = Object.freeze({ min: 15, max: 30 });
const RECOMMENDED_IMAGE_MIN_WIDTH = 1200;
function normalizeText(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function isHttpsUrl(value) { const normalized = normalizeText(value); return Boolean(normalized && /^https:\/\//i.test(normalized)); }
function normalizePositiveInteger(value) { return Number.isInteger(value) && value > 0 ? value : null; }
function normalizeMediaAsset(asset, businessId) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) return null;
  const assetId = normalizeText(asset.assetId), ownerBusinessId = normalizeText(asset.businessId);
  const kind = normalizeText(asset.kind), state = normalizeText(asset.state), purpose = normalizeText(asset.purpose);
  if (!assetId || !ownerBusinessId || ownerBusinessId !== businessId || !MEDIA_ASSET_KINDS.includes(kind) ||
      !MEDIA_ASSET_STATES.includes(state) || (purpose && !MEDIA_ASSET_PURPOSES.includes(purpose))) return null;
  const normalized = { assetId, businessId: ownerBusinessId, kind, state, ...(purpose ? { purpose } : {}) };
  const brandReference = normalizeText(asset.brandReference); if (brandReference) normalized.brandReference = brandReference;
  const relatedEntityId = normalizeText(asset.relatedEntityId); if (relatedEntityId) normalized.relatedEntityId = relatedEntityId;
  const contentType = normalizeText(asset.contentType);
  if (contentType) {
    if (kind === "image" && !IMAGE_CONTENT_TYPES.includes(contentType)) return null;
    if (kind === "video" && !VIDEO_CONTENT_TYPES.includes(contentType)) return null;
    normalized.contentType = contentType;
  }
  const sizeBytes = normalizePositiveInteger(asset.sizeBytes);
  if (sizeBytes) { if (kind === "image" && sizeBytes > MAX_IMAGE_BYTES) return null; normalized.sizeBytes = sizeBytes; }
  const width = normalizePositiveInteger(asset.width); if (width) normalized.width = width;
  const height = normalizePositiveInteger(asset.height); if (height) normalized.height = height;
  const durationSeconds = typeof asset.durationSeconds === "number" && asset.durationSeconds > 0 ? asset.durationSeconds : null;
  if (durationSeconds) { if (kind !== "video" || durationSeconds > MAX_VIDEO_DURATION_SECONDS) return null; normalized.durationSeconds = durationSeconds; }
  const storageKey = normalizeText(asset.storageKey); if (storageKey) normalized.storageKey = storageKey;
  const etag = normalizeText(asset.etag); if (etag) normalized.etag = etag;
  const deliveryUrl = normalizeText(asset.deliveryUrl);
  if (deliveryUrl) { if (!isHttpsUrl(deliveryUrl)) return null; normalized.deliveryUrl = deliveryUrl; }
  const createdAt = normalizeText(asset.createdAt); if (createdAt) normalized.createdAt = createdAt;
  const updatedAt = normalizeText(asset.updatedAt); if (updatedAt) normalized.updatedAt = updatedAt;
  const failureReason = normalizeText(asset.failureReason); if (failureReason && state === "failed") normalized.failureReason = failureReason.slice(0, 500);
  return normalized;
}
function toPublicMediaAsset(asset, businessId) {
  const normalized = normalizeMediaAsset(asset, businessId);
  if (!normalized || normalized.state !== "ready" || !normalized.deliveryUrl) return null;
  return { assetId: normalized.assetId, kind: normalized.kind, deliveryUrl: normalized.deliveryUrl,
    ...(normalized.contentType ? { contentType: normalized.contentType } : {}),
    ...(normalized.width ? { width: normalized.width } : {}), ...(normalized.height ? { height: normalized.height } : {}),
    ...(normalized.durationSeconds ? { durationSeconds: normalized.durationSeconds } : {}) };
}
function getMediaGuidance(asset) {
  const guidance = [];
  if (!asset || typeof asset !== "object") return guidance;
  if (asset.kind === "image" && Number.isInteger(asset.width) && asset.width < RECOMMENDED_IMAGE_MIN_WIDTH) {
    guidance.push("For stronger marketing quality, use an original image at least 1200 pixels wide.");
  }
  if (asset.kind === "video" && typeof asset.durationSeconds === "number" &&
      (asset.durationSeconds < RECOMMENDED_VIDEO_DURATION_SECONDS.min || asset.durationSeconds > RECOMMENDED_VIDEO_DURATION_SECONDS.max)) {
    guidance.push("For most DEMEOS marketing work, a 15 to 30 second video is recommended.");
  }
  return guidance;
}
module.exports = { MEDIA_ASSET_KINDS, MEDIA_ASSET_STATES, MEDIA_ASSET_PURPOSES, IMAGE_CONTENT_TYPES, VIDEO_CONTENT_TYPES,
  MAX_IMAGE_BYTES, MAX_VIDEO_DURATION_SECONDS, RECOMMENDED_VIDEO_DURATION_SECONDS, RECOMMENDED_IMAGE_MIN_WIDTH,
  normalizeMediaAsset, toPublicMediaAsset, getMediaGuidance };
