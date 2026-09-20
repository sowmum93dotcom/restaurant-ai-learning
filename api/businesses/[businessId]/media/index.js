const { randomUUID } = require("node:crypto");
const { getRepository } = require("../../_lib/persistence.js");
const { authorizeBusinessOwnerRequest } = require("../../_lib/demeos-business-owner-authorization.js");
const { DEMEOS_ACTIONS } = require("../../_lib/demeos-rules.js");
const { normalizeMediaAsset, getMediaGuidance } = require("../../_lib/media-asset-contract.js");
const { createMediaUploadSession } = require("../../_lib/media-upload-session.js");
const { getConfiguredMediaStorageAdapter } = require("../../_lib/media-storage-driver.js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  if (!businessId) return res.status(400).json({ error: "A businessId is required." });
  try {
    const repository = getRepository();
    const access = await authorizeBusinessOwnerRequest({ req, businessId, action: DEMEOS_ACTIONS.MANAGE_BUSINESS_MEDIA, repository });
    if (!access.authenticated) return res.status(401).json({ error: "Authentication required." });
    if (!access.allowed) return res.status(403).json({ error: "Forbidden." });
    if (req.method === "GET") {
      const assets = await repository.getBusinessMediaAssets(businessId, 100);
      return res.status(200).json({ assets });
    }
    const supplied = req.body && req.body.asset;
    const asset = normalizeMediaAsset({
      ...supplied, assetId: "media-" + randomUUID(), businessId, state: "pending-upload",
      createdAt: new Date().toISOString()
    }, businessId);
    if (!asset) return res.status(400).json({ error: "DEMEOS received invalid media information." });
    const saved = await repository.saveBusinessMediaAsset(businessId, asset);
    if (!saved) return res.status(409).json({ error: "Media asset could not be registered for this business." });
    const uploadSession = createMediaUploadSession(saved);\n    const storage = uploadSession ? getConfiguredMediaStorageAdapter() : null;\n    const storageUpload = storage ? await storage.createUpload(saved, uploadSession) : null;\n    return res.status(201).json({ asset: saved, guidance: getMediaGuidance(saved),\n      ...(uploadSession && storageUpload ? { uploadSession: { uploadToken: uploadSession.uploadToken, expiresAt: uploadSession.expiresAt, storageKey: storageUpload.storageKey, uploadUrl: storageUpload.uploadUrl } } : { uploadStatus: "storage-not-configured" }) });
  } catch (error) {
    console.error("Could not manage business media:", error);
    return res.status(500).json({ error: "DEMEOS could not manage business media." });
  }
};
