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
 return {frames:storage&&Boolean(backend.drivers?.extractVideoFrames&&backend.driver?.deleteObject),images:storage&&Boolean(backend.drivers?.inspectImage&&backend.drivers?.optimizeImage),videos:storage&&Boolean(backend.drivers?.inspectVideo&&backend.drivers?.transcodeVideo),
  blocker:!storage?'Private storage and a media upload secret must be configured.':!backend.drivers?'Image/video processing is not configured.':!backend.drivers.transcodeVideo?'Video transcoding is not configured. Images are supported.':''};
}
async function listMedia(store,profile,backend){
 if(typeof store.getBusinessMediaAssets!=='function')return [];
 let assets=await store.getBusinessMediaAssets(profile.businessId,100);
 const products=new Map((profile.products||[]).map(p=>[p.productId,p]));
 const positions=new Map((profile.products||[]).map(p=>[p.productId,new Map((p.mediaGallery?.assetIds||[]).map((id,i)=>[id,i]))]));
 const galleryIds=(profile.products||[]).flatMap(p=>p.mediaGallery?.assetIds||[]);
 for(let i=0;i<galleryIds.length;i+=20)assets.push(...await store.getBusinessMediaAssetsByIds(profile.businessId,galleryIds.slice(i,i+20)));
 assets=Array.from(new Map(assets.map(a=>[a.assetId,a])).values()).filter(a=>a.businessId===profile.businessId&&['product','service'].includes(a.purpose)&&a.state!=='archived'&&products.has(a.relatedEntityId));
 assets.sort((a,b)=>a.relatedEntityId.localeCompare(b.relatedEntityId)||((positions.get(a.relatedEntityId)?.get(a.assetId)??-1)-(positions.get(b.relatedEntityId)?.get(b.assetId)??-1)));
 return Promise.all(assets.map(async asset=>{
  let previewUrl=null;
  const prefix=`businesses/${encodeURIComponent(profile.businessId)}/media/${encodeURIComponent(asset.assetId)}/processed/`;
  const thumbnail=asset.kind==='image'?asset.derivatives?.find(d=>d.role==='thumbnail'&&d.storageKey?.startsWith(prefix))?.storageKey:null;
  if(asset.state==='ready'&&asset.processedStorageKey?.startsWith(prefix))previewUrl=(await backend.adapter?.createDeliveryRead({storageKey:thumbnail||asset.processedStorageKey,expiresAt:new Date(Date.now()+10*60*1000).toISOString()}))?.deliveryUrl||null;
  let framePreviews=[];
  if(asset.state==='ready'&&require('./selling-video-frames').validate(asset,asset.videoFrames)){framePreviews=await Promise.all(asset.videoFrames.frames.map(async f=>({...f,previewUrl:(await backend.adapter?.createDeliveryRead({storageKey:f.storageKey,expiresAt:new Date(Date.now()+600000).toISOString()}))?.deliveryUrl||null})));framePreviews=framePreviews.map(({storageKey,...frame})=>frame);}
  return {framePreviews,assetId:asset.assetId,productId:asset.relatedEntityId,kind:asset.kind,state:asset.state,previewUrl,failureReason:asset.failureReason||'',main:products.get(asset.relatedEntityId)?.mediaGallery?.mainAssetId===asset.assetId,linked:products.get(asset.relatedEntityId)?.mediaGallery?.assetIds?.includes(asset.assetId)||false};
 }));
}
async function readLogo(store,profile,backend){
 const id=profile.logoAssetId;
 if(!id)return null;
 const asset=await store.getBusinessMediaAsset(profile.businessId,id);
 if(!asset||asset.purpose!=='brand'||asset.brandReference!=='primary-brand'||asset.kind!=='image'||asset.state!=='ready')return null;
 const prefix=`businesses/${encodeURIComponent(profile.businessId)}/media/${encodeURIComponent(id)}/processed/`;
 if(!asset.processedStorageKey?.startsWith(prefix))return null;
 const delivery=await backend.adapter?.createDeliveryRead({storageKey:asset.processedStorageKey,expiresAt:new Date(Date.now()+10*60*1000).toISOString()});
 return {assetId:id,previewUrl:delivery?.deliveryUrl||null};
}
async function mutateMedia({store,profile,identity,action,item,backend,env,saveProfile,logo=false}){
 const product=logo?{productId:profile.businessId}:profile.products.find(p=>p.productId===item.productId);
 if(!product)return {status:404,error:'Product not found.'};
 if(action==='register-media'){
  const kind=item.kind,contentType=item.contentType,sizeBytes=item.sizeBytes;
  if(logo&&kind!=='image'||!['image','video'].includes(kind)||!(kind==='image'?contract.IMAGE_CONTENT_TYPES:contract.VIDEO_CONTENT_TYPES).includes(contentType)||!Number.isSafeInteger(sizeBytes)||sizeBytes<1||sizeBytes>(kind==='image'?contract.MAX_IMAGE_BYTES:contract.MAX_VIDEO_BYTES))return {status:400,error:'Choose a supported image up to 15 MB or video up to 250 MB.'};
  const support=capabilities(backend,env);
  if(!(kind==='image'?support.images:support.videos))return {status:503,error:support.blocker||'Media processing is not configured.'};
  const assetId=typeof item.assetId==='string'&&/^media-[a-zA-Z0-9_-]{1,100}$/.test(item.assetId)?item.assetId:'media-'+randomUUID();
  let asset=await store.getBusinessMediaAsset(profile.businessId,assetId);
  if(asset&&(asset.relatedEntityId!==product.productId||asset.contentType!==contentType||asset.sizeBytes!==sizeBytes||asset.state!=='pending-upload'||asset.purpose!==(logo?'brand':product.presentation?.kind==='service'?'service':'product')||(logo&&asset.brandReference!=='primary-brand')))return {status:409,error:'Upload changed. Reload the media library.'};
  if(!asset){asset={assetId,businessId:profile.businessId,kind,contentType,sizeBytes,state:'pending-upload',purpose:logo?'brand':product.presentation?.kind==='service'?'service':'product',...(logo?{brandReference:'primary-brand'}:{}),relatedEntityId:product.productId,createdAt:new Date().toISOString()};asset=await store.saveBusinessMediaAsset(profile.businessId,asset);}
  const session=asset&&createMediaUploadSession(asset),upload=session&&await backend.adapter.createUpload(asset,session);
  if(!upload)return {status:503,error:'Private media upload could not be started.'};
  return {status:201,assetId:asset.assetId,uploadSession:{...upload,uploadToken:session.uploadToken}};
 }
 if(action==='move-media'){
  const ids=product.mediaGallery?.assetIds||[],index=ids.indexOf(item.assetId);
  if(index<0||!['earlier','later'].includes(item.direction))return {status:400,error:'Choose linked media and a valid direction.'};
  const selected=await store.getBusinessMediaAsset(profile.businessId,item.assetId);
  if(!selected||selected.businessId!==profile.businessId||selected.relatedEntityId!==product.productId||!['product','service'].includes(selected.purpose)||selected.state!=='ready')return {status:400,error:'Choose ready media linked to this product.'};
  const target=index+(item.direction==='earlier'?-1:1);if(target<0||target>=ids.length)return {status:200,ok:true};
  const ordered=ids.slice();[ordered[index],ordered[target]]=[ordered[target],ordered[index]];
  const next={...profile,products:profile.products.map(p=>p.productId===product.productId?{...p,mediaGallery:{...p.mediaGallery,assetIds:ordered}}:p)};
  if(!await saveProfile(profile,next))return {status:409,error:'Product changed. Reload before ordering media.'};
  return {status:200,ok:true};
 }
 const asset=await store.getBusinessMediaAsset(profile.businessId,item.assetId);
 if(!asset||asset.relatedEntityId!==product.productId||!(logo?asset.purpose==='brand'&&asset.brandReference==='primary-brand'&&asset.kind==='image':['product','service'].includes(asset.purpose)))return {status:404,error:'Product media not found.'};
 if(action==='extract-video-frames')return require('./selling-video-frames').prepare({store,identity,profile,product,asset,backend});
 if(action==='remove-media'&&asset.kind==='video'&&!await require('./selling-video-frames').cleanup({store,identity,asset,backend}))return {status:503,error:'Frame cleanup is incomplete. Retry removal.'};
 if(action==='set-main-media'&&(asset.state!=='ready'||asset.kind!=='image'||!product.mediaGallery?.assetIds?.includes(asset.assetId)))return {status:400,error:'Choose a ready image linked to this product.'};
 if(action==='complete-media'||action==='resume-media'){
  if(action==='resume-media'&&!['processing','ready'].includes(asset.state))return {status:409,error:'Only a previously verified upload can resume processing.'};
  const processing=action==='resume-media'?{...asset,uploadCompletionReplay:true}:await completeVerifiedMediaUpload({asset,businessId:profile.businessId,assetId:asset.assetId,uploadToken:item.uploadToken,storageKey:item.storageKey,storageAdapter:backend.adapter});
  if(!processing)return {status:409,error:'The uploaded file could not be verified.'};
  if(!processing.uploadCompletionReplay&&!(await enqueueVerifiedMediaForProcessing(store,processing)))return {status:503,error:'Media processing could not be queued.'};
  if(processing.state!=='ready'&&backend.driver&&backend.drivers){
   const scoped={...store,claimNextMediaProcessingJob:attempts=>store.claimNextMediaProcessingJob(attempts,profile.businessId,asset.assetId),recoverStaleMediaProcessingJobs:typeof store.recoverStaleMediaProcessingJobs==='function'?(attempts,lease,limit)=>store.recoverStaleMediaProcessingJobs(attempts,lease,limit,profile.businessId,asset.assetId):undefined,reconcileUnqueuedProcessingMedia:undefined};
   await createMediaWorker({repository:scoped,drivers:backend.drivers,createProcessingRead:backend.driver.createProcessingRead,createProcessingWrite:backend.driver.createProcessingWrite,createDeliveryRead:backend.driver.createDeliveryRead,verifyProcessedOutput:backend.driver.verifyUpload})();
  }
  const current=await store.getBusinessMediaAsset(profile.businessId,asset.assetId);
  if(current?.state!=='ready')return {status:202,state:current?.state||'processing',message:'File stored. Processing has not completed; reload to check its status.'};
 }
 if(action==='remove-media'&&!logo){
  if(asset.state!=='archived'){
   const archived=transitionMediaAsset(asset,profile.businessId,'archived');
   if(!archived||!await store.saveBusinessMediaAsset(profile.businessId,archived))return {status:409,error:'Media could not be removed.'};
  }
 }
 const refreshed=await store.getKnownBusiness(profile.businessId),current=refreshed?.businessProfile;
 if(!current||!await store.isBusinessOwnedByIdentity(identity,profile.businessId))return {status:403,error:'Business access changed.'};
 if(logo){
  if(action==='remove-media'&&current.logoAssetId!==asset.assetId)return {status:409,error:'Business logo changed. Reload before removing it.'};
  const next={...current};
  if(action==='remove-media')delete next.logoAssetId;else next.logoAssetId=asset.assetId;
  if(!await saveProfile(current,next))return {status:409,error:'Business changed. Reload before saving the logo.'};
  // Keep the previous logo visible until the replacement has been decoded and saved.
  const oldId=action==='remove-media'?asset.assetId:current.logoAssetId;
  if(oldId&&oldId!==next.logoAssetId){
   const old=await store.getBusinessMediaAsset(profile.businessId,oldId);
   if(old?.purpose==='brand'&&old.brandReference==='primary-brand'){
    const archived=transitionMediaAsset(old,profile.businessId,'archived');
    if(archived)await store.saveBusinessMediaAsset(profile.businessId,archived);
   }
  }
  return {status:200,ok:true};
 }
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
module.exports={mediaBackend,capabilities,listMedia,readLogo,mutateMedia};
