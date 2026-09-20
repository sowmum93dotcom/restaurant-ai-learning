const { createHmac, timingSafeEqual } = require("node:crypto");
const UPLOAD_SESSION_TTL_SECONDS = 15 * 60;
function requiredSecret() {
  const secret = process.env.DEMEOS_MEDIA_UPLOAD_SECRET;
  return typeof secret === "string" && secret.length >= 32 ? secret : null;
}
function sign(payload, secret) { return createHmac("sha256", secret).update(payload).digest("base64url"); }
function createMediaUploadSession({ businessId, assetId, contentType, sizeBytes, now = Date.now() }) {
  const secret = requiredSecret();
  if (!secret) return null;
  const expiresAt = new Date(now + UPLOAD_SESSION_TTL_SECONDS * 1000).toISOString();
  const payload = [businessId, assetId, contentType || "", String(sizeBytes || ""), expiresAt].join("\n");
  const signature = sign(payload, secret);
  return { assetId, businessId, expiresAt, uploadToken: Buffer.from(payload).toString("base64url") + "." + signature,
    uploadPath: "/api/media/uploads/" + encodeURIComponent(assetId) };
}
function verifyMediaUploadToken(token, { businessId, assetId, now = Date.now() } = {}) {
  const secret = requiredSecret();
  if (!secret || typeof token !== "string" || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  let payload; try { payload = Buffer.from(encoded, "base64url").toString("utf8"); } catch { return null; }
  const expected = sign(payload, secret);
  const a=Buffer.from(signature), b=Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a,b)) return null;
  const [tokenBusinessId, tokenAssetId, contentType, sizeText, expiresAt] = payload.split("\n");
  if (tokenBusinessId !== businessId || tokenAssetId !== assetId || Date.parse(expiresAt) <= now) return null;
  return { businessId: tokenBusinessId, assetId: tokenAssetId, contentType: contentType || null,
    sizeBytes: sizeText ? Number(sizeText) : null, expiresAt };
}
module.exports={UPLOAD_SESSION_TTL_SECONDS,createMediaUploadSession,verifyMediaUploadToken};
