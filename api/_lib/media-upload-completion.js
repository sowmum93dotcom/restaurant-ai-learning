const { verifyMediaUploadToken }=require("./media-upload-session.js");
const { transitionMediaAsset }=require("./media-processing-lifecycle.js");
async function completeVerifiedMediaUpload({asset,businessId,assetId,uploadToken,storageKey,storageAdapter,now=Date.now()}){
 if(!asset||asset.businessId!==businessId||asset.assetId!==assetId||!storageAdapter)return null;
 const token=verifyMediaUploadToken(uploadToken,{businessId,assetId,now});
 if(!token)return null;
 if((token.contentType||null)!==(asset.contentType||null))return null;
 if((token.sizeBytes||null)!==(asset.sizeBytes||null))return null;
 const verified=await storageAdapter.verifyUpload(asset,storageKey);
 if(!verified)return null;
 return transitionMediaAsset(asset,businessId,"processing",{storageKey:verified.storageKey,etag:verified.etag||undefined},
   new Date(now).toISOString());
}
module.exports={completeVerifiedMediaUpload};
