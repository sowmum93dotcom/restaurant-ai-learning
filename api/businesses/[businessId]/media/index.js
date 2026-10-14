const { randomUUID } = require("node:crypto");
const { getRepository } = require("../../../_lib/persistence.js");
const { authorizeBusinessOwnerRequest } = require("../../../_lib/demeos-business-owner-authorization.js");
const { DEMEOS_ACTIONS } = require("../../../_lib/demeos-rules.js");
const { normalizeMediaAsset, getMediaGuidance } = require("../../../_lib/media-asset-contract.js");
const { createMediaUploadSession } = require("../../../_lib/media-upload-session.js");
const { getConfiguredMediaStorageAdapter } = require("../../../_lib/media-storage-driver.js");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
  if (!businessId) return res.status(400).json({ error: "A businessId is required." });
  try {
    const repository = getRepository();
    const access = await authorizeBusinessOwnerRequest({ req, businessId, action: DEMEOS_ACTIONS.MANAGE_BUSINESS_MEDIA, repository, application: req.query.application });
    if (!access.authenticated) return res.status(401).json({ error: "Authentication required." });
    if (!access.allowed) return res.status(403).json({ error: "Forbidden." });
    const accessRecord = await repository.getKnownBusiness(businessId);
    const grants = require('../../../_lib/business-application-access').applicationAccess(accessRecord, businessId);
    const application = req.query.application;
    if (application !== undefined && (!['marketing','selling'].includes(application) || !grants[application]))
      return res.status(403).json({error:'Application access required.'});
    if (req.method === "GET") {
      let assets = await repository.getBusinessMediaAssets(businessId, 100);
      const record = await repository.getKnownBusiness(businessId);
      const profile = record?.businessProfile;
      if (profile?.businessId === businessId && profile.applicationAccess?.selling === true) {
        // Recent uploads stay bounded, but saved galleries must survive catalogue reopening.
        const galleries = (Array.isArray(profile.products) ? profile.products : []).slice(0, 100)
          .filter(product => product?.businessId === businessId && Array.isArray(product.mediaGallery?.assetIds));
        const saved = await Promise.all(galleries.map(async product => {
          const linked = await repository.getBusinessMediaAssetsByIds(businessId, product.mediaGallery.assetIds.slice(0, 20));
          return linked.filter(asset => asset.relatedEntityId === product.productId && asset.businessId === businessId);
        }));
        assets = Array.from(new Map([...assets, ...saved.flat()].map(asset => [asset.assetId, asset])).values());
      }
      const visible=grants.marketing && application !== 'selling' ? assets : assets.filter(asset => asset.purpose !== 'marketing');
      if(visible.some(asset=>asset.state==='processing'))require('../../../_lib/business-media-runtime').scheduleBusinessMediaProcessing(repository,businessId);
      return res.status(200).json({ assets: await require('../../../_lib/business-media-runtime').hydratePrivateBusinessMedia(visible,businessId) });
    }
    const supplied = req.body && req.body.asset;
    const asset = normalizeMediaAsset({
      ...supplied, assetId: "media-" + randomUUID(), businessId, state: "pending-upload",
      createdAt: new Date().toISOString()
    }, businessId);
    if (!asset) return res.status(400).json({ error: "DEMEOS received invalid media information." });
    if (asset.purpose === 'marketing' && !grants.marketing) return res.status(403).json({error:'Marketing application access required.'});
    if (asset.relatedEntityId || ["product", "service"].includes(asset.purpose)) {
      const record = await repository.getKnownBusiness(businessId);
      const products = record?.businessProfile?.businessId === businessId && Array.isArray(record.businessProfile.products) ? record.businessProfile.products : [];
      const product=products.find(product => product && product.businessId === businessId && product.productId === asset.relatedEntityId);
      if (!asset.relatedEntityId || !product || !["product","service"].includes(asset.purpose) ||
          (product.presentation?.kind && product.presentation.kind !== asset.purpose)) {
        return res.status(409).json({error:"Save an owned product or service before attaching its media."});
      }
    }

    if(process.env.DEMEOS_MEDIA_PROCESSING_PROVIDER==='native'&&(!getConfiguredMediaStorageAdapter()||typeof process.env.DEMEOS_MEDIA_UPLOAD_SECRET!=='string'||process.env.DEMEOS_MEDIA_UPLOAD_SECRET.length<32))return res.status(503).json({error:'Private uploads are temporarily unavailable. Your saved products are unchanged.'});
    const saved = await repository.saveBusinessMediaAsset(businessId, asset);
    if (!saved) return res.status(409).json({ error: "Media asset could not be registered for this business." });
    const uploadSession = createMediaUploadSession(saved);
    const storage = uploadSession ? getConfiguredMediaStorageAdapter() : null;
    const storageUpload = storage ? await storage.createUpload(saved, uploadSession) : null;
    return res.status(201).json({ asset: saved, guidance: getMediaGuidance(saved),
      ...(uploadSession && storageUpload ? { uploadSession: { uploadToken: uploadSession.uploadToken, expiresAt: uploadSession.expiresAt, storageKey: storageUpload.storageKey, uploadUrl: storageUpload.uploadUrl } } : { uploadStatus: "storage-not-configured" }) });
  } catch (error) {
    console.error("Could not manage business media:", error);
    return res.status(500).json({ error: "DEMEOS could not manage business media." });
  }
};
