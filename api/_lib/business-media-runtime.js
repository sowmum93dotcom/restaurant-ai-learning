'use strict';
const {getConfiguredMediaStorageAdapter}=require('./media-storage-driver');
const {getConfiguredMediaProcessingDrivers}=require('./media-processing-driver');
function scheduleBusinessMediaProcessing(repository,businessId){
 if(process.env.DEMEOS_MEDIA_PROCESSING_PROVIDER!=='native')return;
 const storage=process.env.DEMEOS_MEDIA_STORAGE_PROVIDER==='vercel-blob'?require('./media-storage-driver').createVercelBlobStorageDriver({token:process.env.BLOB_READ_WRITE_TOKEN}):null,drivers=getConfiguredMediaProcessingDrivers();
 if(!storage||!drivers)return;
 const run=require('./media-worker').createMediaWorker({repository,businessId,drivers,createProcessingRead:storage.createProcessingRead,createProcessingWrite:storage.createProcessingWrite,verifyProcessedOutput:storage.verifyUpload});
 require('@vercel/functions').waitUntil(run().catch(()=>console.warn('DEMEOS business media processing could not complete.')));
}
async function hydratePrivateBusinessMedia(assets,businessId,storage=getConfiguredMediaStorageAdapter()){
 if(process.env.DEMEOS_MEDIA_STORAGE_PROVIDER!=='vercel-blob'||!storage)return assets;
 const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
 return Promise.all(assets.map(async asset=>{
  if(asset.state!=='ready')return asset;
  const next={...asset};delete next.deliveryUrl;
  const prefix=['businesses',encodeURIComponent(businessId),'media',encodeURIComponent(asset.assetId),'processed',''].join('/');
  async function delivery(key){
   if(asset.businessId!==businessId||typeof key!=='string'||!['master.webp','thumbnail.webp','customer.webp','marketing.webp','master.mp4','customer.mp4','marketing.mp4'].some(name=>key===prefix+name))return null;
   const read=await storage.createDeliveryRead({storageKey:key,expiresAt});return read?.deliveryUrl;
  }
  const url=await delivery(asset.processedStorageKey);if(url)next.deliveryUrl=url;
  if(Array.isArray(asset.derivatives))next.derivatives=await Promise.all(asset.derivatives.map(async derivative=>{const item={...derivative};delete item.deliveryUrl;const url=await delivery(item.storageKey);if(url)item.deliveryUrl=url;return item;}));
  return next;
 }));
}
module.exports={scheduleBusinessMediaProcessing,hydratePrivateBusinessMedia};
