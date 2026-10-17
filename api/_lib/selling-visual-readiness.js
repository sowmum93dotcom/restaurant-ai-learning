'use strict';
const {hash}=require('./selling-native-intelligence');
const {catalogueRevision}=require('./vendor-inventory');
const {dataEnvironment}=require('./selling-access');
function mediaRevision(assets){
 return hash(assets.map(a=>({assetId:a.assetId,state:a.state,productId:a.relatedEntityId,processedHash:a.processedHash||null,processedStorageKey:a.processedStorageKey||null,frames:a.videoFrames||null})).sort((a,b)=>a.assetId.localeCompare(b.assetId)));
}
function technicalDetails(product,assets,businessId){
 return assets.filter(a=>a.businessId===businessId&&a.relatedEntityId===product.productId&&['product','service'].includes(a.purpose)&&a.state!=='archived').slice(0,64).map(a=>({
  assetId:a.assetId,kind:a.kind,state:a.state,width:a.width||null,height:a.height||null,
  aspectRatio:a.width&&a.height?a.width/a.height:null,sizeBytes:a.sizeBytes||null,contentType:a.contentType||null,
  sampledFrames:require('./selling-video-frames').validate(a,a.videoFrames)?a.videoFrames.frames.map(({storageKey,...f})=>f):[],
  durationSeconds:a.durationSeconds||null,sourceHash:a.sourceHash||null,
  processedHash:a.processedHash||null,processedSizeBytes:a.processedSizeBytes||null,
  representation:{schemaVersion:1,status:a.kind==='image'&&a.state==='ready'&&a.processedHash?'hash-verified-image':'preprocessing-required',embeddings:'unavailable'},
  // A sampling plan is not an extracted frame, full-video review or safety result.
  ...(a.kind==='video'&&a.state==='ready'&&Number.isFinite(a.durationSeconds)&&a.durationSeconds>0&&a.durationSeconds<=60?{samplingPlan:{schemaVersion:1,sourceAssetId:a.assetId,status:'extraction-required',maxFrames:4,maxWidth:640,maxHeight:640,maxFrameBytes:262144,timestampsSeconds:Array.from({length:4},(_,i)=>Number((a.durationSeconds*(i+.5)/4).toFixed(3)))}}:{})
 }));
}
function createVisualAuthorizer({store,environment=()=>process.env}){
 return async(identity,input)=>{
  if(!identity||!dataEnvironment(input.businessId,environment(),identity)||!await store.isBusinessOwnedByIdentity(identity,input.businessId))return false;
  const business=await store.getKnownBusiness(input.businessId),profile=business?.businessProfile;
  if(!profile||!profile.applicationAccess?.selling&&dataEnvironment(input.businessId,environment(),identity)!=='test')return false;
  const product=profile.products?.find(p=>p.productId===input.productId&&p.businessId===input.businessId);
  if(!product||catalogueRevision(product)!==input.productRevision)return false;
  const assets=await store.getSellingIntelligenceMedia(identity,input.businessId,product);
  if(mediaRevision(assets)!==input.mediaRevision)return false;
  // Only hash-verified bounded image representations exist in this release.
  // Video frames remain rejected until extraction/storage provenance is deployed.
  if(input.capability==='video-frame-semantics'){const frames=require('./selling-video-frames');return input.media.every(m=>assets.some(a=>a.businessId===input.businessId&&a.relatedEntityId===input.productId&&a.state==='ready'&&product.mediaGallery?.assetIds?.includes(a.assetId)&&a.assetId===m.assetId&&frames.validate(a,a.videoFrames)&&a.videoFrames.frames.some(f=>f.index===m.frameIndex&&f.timestampSeconds===m.timestampSeconds&&f.contentHash===m.contentHash&&f.sizeBytes===m.sizeBytes&&f.width===m.width&&f.height===m.height&&f.contentType===m.contentType)))&&new Set(input.media.map(m=>m.assetId)).size===1;}
  if(input.capability!=='image-semantics')return false;
  return input.media.every(m=>assets.some(a=>a.assetId===m.assetId&&a.businessId===input.businessId&&a.relatedEntityId===input.productId&&['product','service'].includes(a.purpose)&&a.state==='ready'&&a.kind==='image'&&product.mediaGallery?.assetIds?.includes(a.assetId)&&a.processedHash===m.contentHash&&a.processedSizeBytes===m.sizeBytes&&a.width===m.width&&a.height===m.height&&m.contentType==='image/webp'&&a.processedStorageKey?.startsWith(`businesses/${encodeURIComponent(input.businessId)}/media/${encodeURIComponent(a.assetId)}/processed/`)));
 };
}
module.exports={mediaRevision,technicalDetails,createVisualAuthorizer};
