'use strict';
// Private original files for the existing controlled inspection, never business authority.
const {createHash,createHmac,randomUUID,timingSafeEqual}=require('node:crypto');
const {normalizeMediaAsset}=require('./media-asset-contract');
const {createMediaUploadSession}=require('./media-upload-session');
const {completeVerifiedMediaUpload}=require('./media-upload-completion');
const {getConfiguredMediaStorageAdapter}=require('./media-storage-driver');
const STORE='store_CFrfc2lIe1tGwbgE',BRANCH='business-approval-application-access-705',BUSINESS='test-vendor-inspection-705';
function configured(env){return env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF===BRANCH&&env.BLOB_STORE_ID===STORE&&env.DEMEOS_MEDIA_STORAGE_PROVIDER==='vercel-blob'&&Boolean(env.BLOB_READ_WRITE_TOKEN)&&typeof env.DEMEOS_MEDIA_UPLOAD_SECRET==='string'&&env.DEMEOS_MEDIA_UPLOAD_SECRET.length>=32&&typeof env.DEMEOS_INSPECTION_MEDIA_IDENTITY_ID==='string'&&env.DEMEOS_INSPECTION_MEDIA_IDENTITY_ID.length>0;}
function permitted(env,identityId){return configured(env)&&env.DEMEOS_INSPECTION_MEDIA_IDENTITY_ID===identityId;}
function fail(message,status=400){const error=Error(message);error.status=status;error.safeInspectionMedia=true;throw error;}
function ownerPrefix(identityId){return 'test-cloud-'+createHash('sha256').update(identityId).digest('hex').slice(0,24)+'-';}
function payload(asset){return JSON.stringify([asset.businessId,asset.assetId,asset.state,asset.kind,asset.purpose,asset.relatedEntityId,asset.contentType,asset.sizeBytes,asset.width||null,asset.height||null,asset.durationSeconds||null]);}
function receipt(asset,secret){return createHmac('sha256',secret).update(payload(asset)).digest('base64url');}
function deliveryReceipt(asset,secret){return createHmac('sha256',secret).update(payload(asset)+'\n'+asset.deliveryUrl+'\n'+asset.inspectionDeliveryExpiresAt).digest('base64url');}
function authentic(asset,identityId,secret){
 if(asset?.businessId!==BUSINESS||typeof asset.assetId!=='string'||!asset.assetId.startsWith(ownerPrefix(identityId))||typeof asset.inspectionMediaReceipt!=='string')return false;
 const expected=Buffer.from(receipt(asset,secret)),provided=Buffer.from(asset.inspectionMediaReceipt);return expected.length===provided.length&&timingSafeEqual(expected,provided);
}
function createCloudMedia({env=process.env,storage=getConfiguredMediaStorageAdapter(env),createSession=createMediaUploadSession,inspectSource=require('./vendor-inspection-source').inspectStoredOriginal,now=()=>Date.now()}={}){
 if(!configured(env)||!storage)return null;
 const secret=env.DEMEOS_MEDIA_UPLOAD_SECRET;
 async function hydrate(state,identityId){
  for(const asset of state.assets){
   if(typeof asset.assetId!=='string'||!asset.assetId.startsWith('test-cloud-'))continue;
   if(!authentic(asset,identityId,secret))fail('This test file does not belong to this account.',403);
   // Ignore client-supplied storage paths and URLs; derive the sole allowed object path.
   delete asset.storageKey;
   delete asset.processedStorageKey;delete asset.derivatives;delete asset.etag;
   if(asset.state==='ready'){
    if(typeof asset.deliveryUrl==='string'&&asset.inspectionDeliveryReceipt===deliveryReceipt(asset,secret)&&Date.parse(asset.inspectionDeliveryExpiresAt)>now()+2*60*1000)continue;
    delete asset.deliveryUrl;
    const key=require('./media-storage-adapter').storageKeyFor(asset);
    asset.inspectionDeliveryExpiresAt=new Date(now()+15*60*1000).toISOString();
    const read=await storage.createDeliveryRead({storageKey:key,expiresAt:asset.inspectionDeliveryExpiresAt});
    if(!read)fail('Private test media could not be opened. Retry inspection.',503);
    asset.deliveryUrl=read.deliveryUrl;asset.inspectionOriginal=true;asset.inspectionDeliveryReceipt=deliveryReceipt(asset,secret);
   }else delete asset.deliveryUrl;
  }
 }
 async function operate(state,identityId,pathname,method,body){
  const base='/api/businesses/'+BUSINESS+'/media';
  if(pathname===base&&method==='POST'){
   if(state.assets.filter(a=>a.assetId?.startsWith('test-cloud-')).length>=100)fail('This inspection supports up to 100 test uploads.',409);
   const supplied=body?.asset;
   if(!supplied||supplied.purpose!=='product'||!state.profile.products.some(p=>p.productId===supplied.relatedEntityId))fail('Choose a saved sample product.');
   // Whitelist metadata; client URLs, derivatives and storage keys are never accepted.
   const asset=normalizeMediaAsset({assetId:ownerPrefix(identityId)+randomUUID(),businessId:BUSINESS,state:'pending-upload',purpose:'product',kind:supplied.kind,relatedEntityId:supplied.relatedEntityId,contentType:supplied.contentType,sizeBytes:supplied.sizeBytes,width:supplied.width,height:supplied.height,durationSeconds:supplied.durationSeconds},BUSINESS);
   if(!asset?.contentType||!asset.sizeBytes)fail('Check the file type, size and video duration.');
   const session=createSession({...asset,now:now()});if(!session)fail('Test uploads are not configured.',503);
   const upload=await storage.createUpload(asset,session);if(!upload)fail('Private test upload could not start. Retry this file.',503);
   asset.inspectionMediaReceipt=receipt(asset,secret);asset.originalFilename='Private inspection '+asset.kind;
   state.assets.push(asset);
   return {asset,uploadSession:{...upload,uploadToken:session.uploadToken},inspectionOriginal:true};
  }
  if(pathname.startsWith(base+'/')&&method==='PATCH'){
   const id=pathname.slice(base.length+1),asset=state.assets.find(a=>a.assetId===id);
   if(!asset||!authentic(asset,identityId,secret))fail('This test file does not belong to this account.',403);
   if(body?.action!=='complete-upload')fail('This test media operation is unavailable.',403);
   const key=require('./media-storage-adapter').storageKeyFor(asset);
   const completed=await completeVerifiedMediaUpload({asset:{...asset,storageKey:key},businessId:BUSINESS,assetId:id,uploadToken:body.uploadToken,storageKey:body.storageKey,storageAdapter:storage,now:now()});
   if(!completed)fail('The private test upload could not be verified.',409);
   if(asset.state!=='ready'){
    const read=await storage.createDeliveryRead({storageKey:key,expiresAt:new Date(now()+15*60*1000).toISOString()});
    if(!read)fail('The private test upload could not be opened.',503);
    let metadata;try{metadata=await inspectSource(asset,read.deliveryUrl);}catch(error){fail(error.status===409?error.message:'The private test file could not be checked. Retry this file.',error.status===409?409:503);}
    if(!metadata?.width||!metadata.height||(asset.kind==='video'&&!(metadata.durationSeconds>0&&metadata.durationSeconds<=60)))fail('The private test file could not be checked.',409);
    Object.assign(asset,metadata);
   }
   // Preview-only original-file readiness, never normal processing or publication approval.
   asset.state='ready';asset.inspectionOriginal=true;asset.inspectionMediaReceipt=receipt(asset,secret);
   await hydrate(state,identityId);return {asset,inspectionOriginal:true};
  }
  return null;
 }
 function guarded(operation){return async(...args)=>{if(!permitted(env,args[1]))fail('Private test uploads are unavailable for this account.',403);try{return await operation(...args);}catch(error){if(error.safeInspectionMedia)throw error;fail('Private test media is unavailable. Retry inspection.',503);}};}
 return {hydrate:guarded(hydrate),operate:guarded(operate)};
}
module.exports={configured,permitted,createCloudMedia,authentic,ownerPrefix,STORE};
