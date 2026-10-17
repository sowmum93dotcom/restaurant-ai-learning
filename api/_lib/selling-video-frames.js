'use strict';
const {createHash}=require('node:crypto');
const VERSION='demeos-video-frames-v1',digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const prefix=a=>`businesses/${encodeURIComponent(a.businessId)}/media/${encodeURIComponent(a.assetId)}/processed/frames-v1/`;
const keys=a=>Array.from({length:4},(_,i)=>prefix(a)+'frame-'+i+'.jpg');
const revision=a=>createHash('sha256').update(JSON.stringify([VERSION,a.businessId,a.assetId,a.processedStorageKey,a.width,a.height,a.durationSeconds])).digest('hex');
function validate(a,v){
 return a.kind==='video'&&v?.version===VERSION&&v.sourceAssetId===a.assetId&&v.sourceRevision===revision(a)&&v.sourceStorageKey===a.processedStorageKey&&Number.isFinite(v.sourceDurationSeconds)&&v.sourceDurationSeconds>0&&v.sourceDurationSeconds<=60&&Math.abs(v.sourceDurationSeconds-a.durationSeconds)<=.1&&digest(v.sourceHash)&&v.limitation==='four-sampled-frames-not-full-video'&&Array.isArray(v.frames)&&v.frames.length===4&&Array.from(v.frames).every((f,i)=>f&&f.index===i&&f.storageKey===keys(a)[i]&&digest(f.contentHash)&&Number.isSafeInteger(f.sizeBytes)&&f.sizeBytes>0&&f.sizeBytes<=262144&&Number.isSafeInteger(f.width)&&f.width>0&&f.width<=640&&Number.isSafeInteger(f.height)&&f.height>0&&f.height<=640&&f.contentType==='image/jpeg'&&Number.isFinite(f.timestampSeconds)&&Math.abs(f.timestampSeconds-v.sourceDurationSeconds*(i+.5)/4)<.002);
}
async function cleanup({store,identity,asset,backend}){
 if(asset.kind!=='video')return true;
 if(typeof store.getSellingFrameJob!=='function')return !asset.videoFrames;
 await store.reconcileSellingFrameJobs(identity,asset.businessId);
 const job=await store.getSellingFrameJob(identity,asset.businessId,asset.assetId);
 if(!asset.videoFrames&&!job)return true;
 if(job?.state==='running')return false;
 if(typeof backend.driver?.deleteObject!=='function')return false;
 const lease=await store.beginSellingFrameCleanup(identity,asset.businessId,asset.assetId);if(!lease)return false;
 try{
  for(const storageKey of keys(asset))if(!await backend.driver.deleteObject({storageKey}))throw Error('cleanup-failed');
  await store.clearSellingFrameJob(identity,asset.businessId,asset.assetId,lease.lease_id);return true;
 }catch{
  await store.failSellingFrameJob(identity,asset.businessId,asset.assetId,lease.input_hash,{cleanupPending:true,code:'frame-cleanup-failed'},lease.lease_id);return false;
 }
}
async function prepare({store,identity,profile,product,asset,backend}){
 if(asset.kind!=='video'||asset.state!=='ready'||asset.businessId!==profile.businessId||asset.relatedEntityId!==product.productId||!product.mediaGallery?.assetIds?.includes(asset.assetId))return {status:409,error:'Choose ready media linked to this product.'};
 if(typeof backend.drivers?.extractVideoFrames!=='function'||typeof backend.driver?.deleteObject!=='function')return {status:503,error:'Video frame extraction is unavailable.'};
 if(validate(asset,asset.videoFrames))return {status:200,ok:true,cacheHit:true};
 const hash=revision(asset),claimed=await store.claimSellingFrameJob(identity,profile,product,asset,hash);
 if(!claimed)return {status:409,error:'Frame processing is busy or its retry limit was reached.'};
 const start=performance.now();let outputBytes=0;
 try{
  const expiresAt=new Date(Date.now()+120000).toISOString();
  const read=await backend.driver.createProcessingRead({storageKey:asset.processedStorageKey,expiresAt});
  if(!read?.readUrl)throw Error('private-read-unavailable');
  const result=await backend.drivers.extractVideoFrames({...asset,storageKey:asset.processedStorageKey},{sourceUrl:read.readUrl,sourceExpiresAt:expiresAt});
  if(result?.schemaVersion!==1||result.sourceAssetId!==asset.assetId||!digest(result.sourceHash)||result.frames?.length!==4||Math.abs(result.durationSeconds-asset.durationSeconds)>.1)throw Error('invalid-frame-output');
  const frames=[];
  for(const f of result.frames){
   if(typeof f.bytesBase64!=='string'||f.bytesBase64.length>349528)throw Error('invalid-frame-bytes');
   const bytes=Buffer.from(f.bytesBase64,'base64');
   if(bytes.length!==f.sizeBytes||createHash('sha256').update(bytes).digest('hex')!==f.contentHash)throw Error('frame-hash-mismatch');
   const metadata=await require('sharp')(bytes,{limitInputPixels:640*640,failOn:'warning'}).metadata();
   if(metadata.format!=='jpeg'||metadata.width!==f.width||metadata.height!==f.height)throw Error('invalid-frame-image');
   frames.push({index:f.index,timestampSeconds:f.timestampSeconds,width:f.width,height:f.height,sizeBytes:f.sizeBytes,contentHash:f.contentHash,contentType:'image/jpeg',storageKey:keys(asset)[f.index]});
  }
  const videoFrames={version:VERSION,sourceAssetId:asset.assetId,sourceRevision:hash,sourceStorageKey:asset.processedStorageKey,sourceHash:result.sourceHash,sourceDurationSeconds:result.durationSeconds,limitation:'four-sampled-frames-not-full-video',frames,createdAt:new Date().toISOString()};
  if(!validate(asset,videoFrames))throw Error('invalid-frame-provenance');
  for(const f of frames){
   const bytes=Buffer.from(result.frames[f.index].bytesBase64,'base64'),destination=await backend.driver.createProcessingWrite({storageKey:f.storageKey,contentType:f.contentType,maximumSizeInBytes:262144,expiresAt});
   if(!destination?.uploadUrl||destination.storageKey!==f.storageKey)throw Error('private-write-unavailable');
   const response=await (backend.fetchImpl||fetch)(destination.uploadUrl,{method:'PUT',redirect:'error',headers:{...destination.headers,'Content-Type':f.contentType},body:bytes,signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('frame-storage-failed');
   const stored=await backend.driver.verifyUpload({storageKey:f.storageKey});
   if(!stored?.exists||stored.storageKey!==f.storageKey||stored.contentType!==f.contentType||stored.sizeBytes!==f.sizeBytes)throw Error('frame-storage-verification-failed');
   outputBytes+=f.sizeBytes;
  }
  const metrics={durationMs:Math.round(performance.now()-start),frames:4,outputBytes,modelInvocations:0};
  if(!await store.saveSellingVideoFrames(identity,profile,product,asset,hash,videoFrames,metrics,claimed.lease_id))throw Error('stale-frame-scope');
  return {status:200,ok:true,cacheHit:false,metrics};
 }catch{
  const current=await store.getSellingFrameJob(identity,asset.businessId,asset.assetId);if(current?.lease_id!==claimed.lease_id)return {status:409,error:'Frame processing changed. Reload and review.'};
  let cleanupPending=false;
  for(const storageKey of keys(asset)){try{if(!await backend.driver.deleteObject({storageKey}))cleanupPending=true;}catch{cleanupPending=true;}}
  await store.failSellingFrameJob(identity,asset.businessId,asset.assetId,hash,{durationMs:Math.round(performance.now()-start),outputBytes,modelInvocations:0,cleanupPending,code:'frame-extraction-failed'},claimed.lease_id);
  return {status:503,error:'Video frames could not be prepared. Retry or remove the media.'};
 }
}
module.exports={VERSION,keys,revision,validate,prepare,cleanup};
