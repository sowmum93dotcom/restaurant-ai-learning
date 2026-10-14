'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const {createNativeMediaProcessingDrivers,blobAddress}=require('../api/_lib/native-media-processing');
const {createMediaWorker}=require('../api/_lib/media-worker');
test('real image and MP4 processing persist verified private outputs and renew delivery on reopen',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'demeos-media-test-'));
 try{
  const image=await require('sharp')({create:{width:480,height:320,channels:3,background:'#10253e'}}).png().toBuffer();
  const video=path.join(dir,'video.mp4');await execFile(require('ffmpeg-static'),['-v','error','-f','lavfi','-i','color=c=blue:s=480x320:d=1','-c:v','libx264','-pix_fmt','yuv420p',video]);
  for(const [kind,bytes] of [['image',image],['video',await fs.readFile(video)]]){
   const assets=new Map(),objects=new Map();let finished=false,claimed;
   const asset={businessId:'owned-business',assetId:'asset-'+kind,relatedEntityId:'saved-product',purpose:'product',kind,state:'processing',contentType:kind==='image'?'image/png':'video/mp4',sizeBytes:bytes.length,storageKey:'original'};assets.set(asset.assetId,asset);
   const storage={async createDeliveryRead({storageKey,expiresAt}){return{storageKey,expiresAt,deliveryUrl:'https://test.private.blob.vercel-storage.com/'+storageKey+'?private=renewed'};}};
   const drivers=createNativeMediaProcessingDrivers({storage,async fetchImpl(url,options={}){
    if(options.method==='PUT'){const key=decodeURIComponent(new URL(url).pathname.slice(1));objects.set(key,{bytes:options.body,contentType:options.headers['Content-Type']});return new Response('',{status:200});}
    return new Response(bytes,{status:200});
   }});
   const repository={async claimNextMediaProcessingJob(max,businessId){claimed=businessId;return{job_id:1,business_id:asset.businessId,asset_id:asset.assetId,attempts:1};},async getBusinessMediaAsset(b,id){return assets.get(id);},async saveBusinessMediaAsset(b,a){assets.set(a.assetId,a);return a;},async finishMediaProcessingJob(id,success){finished=success;}};
   const worker=createMediaWorker({repository,businessId:asset.businessId,drivers,async createProcessingRead(){return{readUrl:'https://test.private.blob.vercel-storage.com/source'};},async createProcessingWrite(out){return{...out,uploadUrl:'https://test.private.blob.vercel-storage.com/'+encodeURIComponent(out.storageKey)};},async verifyProcessedOutput({storageKey}){const stored=objects.get(storageKey);return stored?{storageKey,exists:true,contentType:stored.contentType}:null;}});
   const result=await worker();assert.equal(result.status,'completed');assert.equal(claimed,asset.businessId);assert.equal(finished,true);const ready=assets.get(asset.assetId);assert.equal(ready.state,'ready');assert.equal(ready.derivatives.length,kind==='image'?3:2);
   for(const object of objects.values()){
    if(kind==='image')assert.equal((await require('sharp')(object.bytes).metadata()).format,'webp');
    else{const output=path.join(dir,'processed.mp4');await fs.writeFile(output,object.bytes);const {stdout}=await execFile(require('@ffprobe-installer/ffprobe').path,['-v','error','-show_entries','stream=codec_name,pix_fmt','-of','json',output]);const stream=JSON.parse(stdout).streams[0];assert.equal(stream.codec_name,'h264');assert.equal(stream.pix_fmt,'yuv420p');}
   }
   if(kind==='video'&&process.env.DEMEOS_NATIVE_VIDEO_FIXTURE){const master=objects.get(ready.processedStorageKey);await fs.writeFile(process.env.DEMEOS_NATIVE_VIDEO_FIXTURE,'<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DEMEOS native video codec check</title><body style="background:#10253e;color:#f4e5bf;font:18px system-ui;padding:24px"><h1>Controlled video codec check</h1><p>Synthetic one-second video converted by the vendor media processor. No business data.</p><video controls muted playsinline style="width:100%;max-width:480px" src="data:video/mp4;base64,'+master.bytes.toString('base64')+'"></video></body></html>');}
   const previous=process.env.DEMEOS_MEDIA_STORAGE_PROVIDER;process.env.DEMEOS_MEDIA_STORAGE_PROVIDER='vercel-blob';
   try{const reopened=await require('../api/_lib/business-media-runtime').hydratePrivateBusinessMedia([{...ready,deliveryUrl:'https://expired.example/'}],asset.businessId,storage);assert.match(reopened[0].deliveryUrl,/private=renewed/);assert.equal((await require('../api/_lib/business-media-runtime').hydratePrivateBusinessMedia([ready],'foreign-business',storage))[0].deliveryUrl,undefined);}finally{if(previous===undefined)delete process.env.DEMEOS_MEDIA_STORAGE_PROVIDER;else process.env.DEMEOS_MEDIA_STORAGE_PROVIDER=previous;}
  }
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('native processing rejects untrusted source hosts and oversized files',async()=>{
 assert.throws(()=>blobAddress('https://example.org/private'));
 let fetched=false;const drivers=createNativeMediaProcessingDrivers({storage:{createDeliveryRead(){}},fetchImpl(){fetched=true;}});
 await assert.rejects(drivers.inspectImage({sizeBytes:251*1024*1024},{sourceUrl:'https://test.blob.vercel-storage.com/source'}));assert.equal(fetched,false);
});
test('SQL job claims and stale recovery remain business scoped and allow one active job per vendor',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),client=new PGlite();
 try{
  const database=require('../api/_lib/database').createDatabase(client),repo=require('../api/_lib/persistence').createPersistenceRepository(database);await database.ensureSchema();
  for(const businessId of ['vendor-one','vendor-two']){
   await repo.createBusinessForOwner('owner-'+businessId,{businessId,name:businessId});
   for(const id of ['first','second'])await repo.saveProcessingMediaAndEnqueue(businessId,{assetId:businessId+'-'+id,businessId,state:'processing',kind:'image'});
  }
  const first=await repo.claimNextMediaProcessingJob(5,'vendor-one');assert.equal(first.business_id,'vendor-one');assert.equal(await repo.claimNextMediaProcessingJob(5,'vendor-one'),null);
  const second=await repo.claimNextMediaProcessingJob(5,'vendor-two');assert.equal(second.business_id,'vendor-two');
  await client.query("UPDATE demeos_media_processing_jobs SET claimed_at = NOW() - INTERVAL '20 minutes' WHERE status='running'");
  const recovered=await repo.recoverStaleMediaProcessingJobs(5,15,50,'vendor-one');assert.equal(recovered.length,1);assert.equal(recovered[0].business_id,'vendor-one');
  assert.equal((await client.query("SELECT status FROM demeos_media_processing_jobs WHERE job_id=$1",[second.job_id])).rows[0].status,'running');
 }finally{await client.close();}
});
