'use strict';
const {randomUUID}=require('node:crypto');
const contract=require('./media-asset-contract');
const {createMediaUploadSession}=require('./media-upload-session');
const {completeVerifiedMediaUpload}=require('./media-upload-completion');
const {enqueueVerifiedMediaForProcessing}=require('./media-processing-queue');
const {transitionMediaAsset}=require('./media-processing-lifecycle');
const {createMediaWorker}=require('./media-worker');
function mediaBackend(env){
 const storage=require('./media-storage-driver');
 return {adapter:storage.getConfiguredMediaStorageAdapter(env),driver:env.DEMEOS_MEDIA_STORAGE_PROVIDER==='vercel-blob'?storage.createVercelBlobStorageDriver({token:env.BLOB_READ_WRITE_TOKEN}):null,
  drivers:require('./media-processing-driver').getConfiguredMediaProcessingDrivers(env)};
}
function capabilities(backend,env){
 const storage=Boolean(backend.adapter&&backend.driver&&env.DEMEOS_MEDIA_UPLOAD_SECRET?.length>=32);
 return {images:storage&&Boolean(backend.drivers?.inspectImage&&backend.drivers?.optimizeImage),videos:storage&&Boolean(backend.drivers?.inspectVideo&&backend.drivers?.transcodeVideo),
  blocker:!storage?'Private storage and a media upload secret must be configured.':!backend.drivers?'Image/video processing is not configured.':!backend.drivers.transcodeVideo?'Video transcoding is not configured. Images are supported.':''};
}
async function listMedia(store,profile,backend){
 if(typeof store.getBusinessMediaAssets!=='function')return [];
 let assets=await store.getBusinessMediaAssets(profile.businessId,100);
 const galleryIds=(profile.products||[]).flatMap(p=>p.mediaGallery?.assetIds||[]);
 for(let i=0;i<galleryIds.length;i+=20)assets.push(...await store.getBusinessMediaAssetsByIds(profile.businessId,galleryIds.slice(i,i+20)));
 assets=Array.from(new Map(assets.map(a=>[a.assetId,a])).values()).filter(a=>a.businessId===profile.businessId&&['product','service'].includes(a.purpose)&&a.state!=='archived'&&(profile.products||[]).some(p=>p.productId===a.relatedEntityId));
 return Promise.all(assets.map(async asset=>{
  let previewUrl=null;
  const prefix=`businesses/${encodeURIComponent(profile.businessId)}/media/${encodeURIComponent(asset.assetId)}/processed/`;
  if(asset.state==='ready'&&asset.processedStorageKey?.startsWith(prefix))previewUrl=(await backend.adapter?.createDeliveryRead({storageKey:asset.processedStorageKey,expiresAt:new Date(Date.now()+10*60*1000).toISOString()}))?.deliveryUrl||null;
  return {assetId:asset.assetId,productId:asset.relatedEntityId,kind:asset.kind,state:asset.state,previewUrl,failureReason:asset.failureReason||'',main:(profile.products||[]).find(p=>p.productId===asset.relatedEntityId)?.mediaGallery?.mainAssetId===asset.assetId,linked:(profile.products||[]).find(p=>p.productId===asset.relatedEntityId)?.mediaGallery?.assetIds?.includes(asset.assetId)||false};
 }));
}
async function mutateMedia({store,profile,identity,action,item,backend,env,saveProfile}){
 const product=profile.products.find(p=>p.productId===item.productId);
 if(!product)return {status:404,error:'Product not found.'};
 if(action==='register-media'){
  const kind=item.kind,contentType=item.contentType,sizeBytes=item.sizeBytes;
  if(!['image','video'].includes(kind)||!(kind==='image'?contract.IMAGE_CONTENT_TYPES:contract.VIDEO_CONTENT_TYPES).includes(contentType)||!Number.isSafeInteger(sizeBytes)||sizeBytes<1||sizeBytes>(kind==='image'?contract.MAX_IMAGE_BYTES:contract.MAX_VIDEO_BYTES))return {status:400,error:'Choose a supported image up to 15 MB or video up to 250 MB.'};
  const support=capabilities(backend,env);
  if(!(kind==='image'?support.images:support.videos))return {status:503,error:support.blocker||'Media processing is not configured.'};
  const assetId=typeof item.assetId==='string'&&/^media-[a-zA-Z0-9_-]{1,100}$/.test(item.assetId)?item.assetId:'media-'+randomUUID();
  let asset=await store.getBusinessMediaAsset(profile.businessId,assetId);
  if(asset&&(asset.relatedEntityId!==product.productId||asset.contentType!==contentType||asset.sizeBytes!==sizeBytes||asset.state!=='pending-upload'))return {status:409,error:'Upload changed. Reload the media library.'};
  if(!asset){asset={assetId,businessId:profile.businessId,kind,contentType,sizeBytes,state:'pending-upload',purpose:product.presentation?.kind==='service'?'service':'product',relatedEntityId:product.productId,createdAt:new Date().toISOString()};asset=await store.saveBusinessMediaAsset(profile.businessId,asset);}
  const session=asset&&createMediaUploadSession(asset),upload=session&&await backend.adapter.createUpload(asset,session);
  if(!upload)return {status:503,error:'Private media upload could not be started.'};
  return {status:201,assetId:asset.assetId,uploadSession:{...upload,uploadToken:session.uploadToken}};
 }
 const asset=await store.getBusinessMediaAsset(profile.businessId,item.assetId);
 if(!asset||asset.relatedEntityId!==product.productId||!['product','service'].includes(asset.purpose))return {status:404,error:'Product media not found.'};
 if(action==='set-main-media'&&(asset.state!=='ready'||asset.kind!=='image'||!product.mediaGallery?.assetIds?.includes(asset.assetId)))return {status:400,error:'Choose a ready image linked to this product.'};
 if(action==='complete-media'||action==='resume-media'){
  if(action==='resume-media'&&!['processing','ready'].includes(asset.state))return {status:409,error:'Only a previously verified upload can resume processing.'};
  const processing=action==='resume-media'?{...asset,uploadCompletionReplay:true}:await completeVerifiedMediaUpload({asset,businessId:profile.businessId,assetId:asset.assetId,uploadToken:item.uploadToken,storageKey:item.storageKey,storageAdapter:backend.adapter});
  if(!processing)return {status:409,error:'The uploaded file could not be verified.'};
  if(!processing.uploadCompletionReplay&&!(await enqueueVerifiedMediaForProcessing(store,processing)))return {status:503,error:'Media processing could not be queued.'};
  if(processing.state!=='ready'&&backend.driver&&backend.drivers){
   const scoped={...store,claimNextMediaProcessingJob:attempts=>store.claimNextMediaProcessingJob(attempts,profile.businessId,asset.assetId),recoverStaleMediaProcessingJobs:typeof store.recoverStaleMediaProcessingJobs==='function'?(attempts,lease,limit)=>store.recoverStaleMediaProcessingJobs(attempts,lease,limit,profile.businessId,asset.assetId):undefined,reconcileUnqueuedProcessingMedia:undefined};
   await createMediaWorker({repository:scoped,drivers:backend.drivers,createProcessingRead:backend.driver.createProcessingRead,createProcessingWrite:backend.driver.createProcessingWrite,verifyProcessedOutput:backend.driver.verifyUpload})();
  }
  const current=await store.getBusinessMediaAsset(profile.businessId,asset.assetId);
  if(current?.state!=='ready')return {status:202,state:current?.state||'processing',message:'File stored. Processing has not completed; reload to check its status.'};
 }
 if(action==='remove-media'){
  if(asset.state!=='archived'){
   const archived=transitionMediaAsset(asset,profile.businessId,'archived');
   if(!archived||!await store.saveBusinessMediaAsset(profile.businessId,archived))return {status:409,error:'Media could not be removed.'};
  }
 }
 const refreshed=await store.getKnownBusiness(profile.businessId),current=refreshed?.businessProfile;
 if(!current||!await store.isBusinessOwnedByIdentity(identity,profile.businessId))return {status:403,error:'Business access changed.'};
 const next=structuredClone(current),target=next.products.find(p=>p.productId===product.productId);
 if(!target)return {status:409,error:'Product changed while processing media.'};
 const ids=target.mediaGallery?.assetIds||[];
 if(action==='remove-media'){
  const kept=ids.filter(id=>id!==asset.assetId);target.mediaGallery={...target.mediaGallery,assetIds:kept,mainAssetId:target.mediaGallery?.mainAssetId===asset.assetId?'':target.mediaGallery?.mainAssetId||''};
 }else if(action==='set-main-media'){
  target.mediaGallery={...target.mediaGallery,mainAssetId:asset.assetId};
 }else{
  if(!ids.includes(asset.assetId)&&ids.length>=20)return {status:409,error:'A product supports up to 20 media files. Remove a file before linking another.'};
  target.mediaGallery={...target.mediaGallery,assetIds:Array.from(new Set([...ids,asset.assetId])),mainAssetId:target.mediaGallery?.mainAssetId||(asset.kind==='image'?asset.assetId:'')};
 }
 if(!await saveProfile(current,next))return {status:409,error:'Products changed. Reload before linking media.'};
 return {status:200,ok:true};
}
module.exports={mediaBackend,capabilities,listMedia,mutateMedia};
