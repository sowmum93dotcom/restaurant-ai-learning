'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{promisify}=require('node:util'),exec=promisify(require('node:child_process').execFile);
const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence'),{diskStorage}=require('../browser-checks/support/private-object-store');
const frames=require('../api/_lib/selling-video-frames'),{createFfmpegVideoDrivers}=require('../api/_lib/media-ffmpeg-driver');
test('real FFmpeg frames persist privately, reuse cache, enforce SQL ownership and clean up without changing MP4s',async t=>{
 const client=new PGlite(),repo=createPersistenceRepository(createDatabase(client)),disk=await diskStorage(),dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-verification-'));
 try{
  const businessId='frame-shop',product={businessId,productId:'p1',name:'Actual media fixture',mediaGallery:{assetIds:['video1'],mainAssetId:''}},profile={businessId,name:'Frames',applicationAccess:{selling:true},products:[product]};
  await repo.createBusinessForOwner('owner',profile);const saved=(await repo.getKnownBusiness(businessId)).businessProfile;
  const file=path.join(dir,'source.mp4');await exec(require('ffmpeg-static'),['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-t','2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart',file],{timeout:10000});
  const bytes=await fs.readFile(file),storageKey='businesses/frame-shop/media/video1/processed/master.mp4';
  await disk.fetchImpl('https://storage.gate/'+encodeURIComponent(storageKey),{method:'PUT',headers:{'Content-Type':'video/mp4'},body:bytes});
  const asset=await repo.saveBusinessMediaAsset(businessId,{businessId,assetId:'video1',relatedEntityId:'p1',purpose:'product',kind:'video',state:'ready',width:320,height:180,durationSeconds:2,contentType:'video/mp4',sizeBytes:bytes.length,storageKey:'businesses/frame-shop/media/video1/original',processedStorageKey:storageKey,deliveryUrl:'https://storage.gate/'+encodeURIComponent(storageKey)});
  disk.driver.deleteObject=async({storageKey})=>{await fs.rm(disk.file(storageKey),{force:true});return true;};
  disk.drivers={...disk.drivers,...createFfmpegVideoDrivers({fetchImpl:disk.fetchImpl})};
  const request={store:repo,identity:'owner',profile:saved,product:saved.products[0],asset,backend:disk};
  const forbidden=await frames.prepare({...request,identity:'foreign'});assert.equal(forbidden.status,409);
  const [first,duplicate]=await Promise.all([frames.prepare(request),frames.prepare(request)]);assert.equal(first.status,200,JSON.stringify(first));assert.equal(duplicate.status,409);
  const ready=await repo.getBusinessMediaAsset(businessId,'video1');assert.equal(frames.validate(ready,ready.videoFrames),true);assert.equal(ready.videoFrames.frames.length,4);assert.equal(ready.videoFrames.limitation,'four-sampled-frames-not-full-video');
  assert.equal(ready.processedStorageKey,storageKey);assert.deepEqual(await fs.readFile(disk.file(storageKey)),bytes,'Existing MP4 remains byte-identical');
  for(const f of ready.videoFrames.frames){const actual=await fs.readFile(disk.file(f.storageKey));assert.equal(actual.length,f.sizeBytes);assert.equal(require('node:crypto').createHash('sha256').update(actual).digest('hex'),f.contentHash);assert.ok(f.width<=640&&f.height<=640);}
  assert.equal((await frames.prepare({...request,asset:ready})).cacheHit,true);
  const media=await require('../api/_lib/selling-media').listMedia(repo,saved,disk);assert.equal(media[0].framePreviews.length,4);assert.ok(media[0].framePreviews.every(f=>f.previewUrl&&!f.storageKey));
  const authorize=require('../api/_lib/selling-visual-readiness').createVisualAuthorizer({store:repo,environment:()=>({VERCEL_ENV:'production'})});
  const input={capability:'video-frame-semantics',businessId,productId:'p1',productRevision:require('../api/_lib/vendor-inventory').catalogueRevision(saved.products[0]),mediaRevision:require('../api/_lib/selling-visual-readiness').mediaRevision([ready]),media:ready.videoFrames.frames.map(f=>({assetId:'video1',frameIndex:f.index,timestampSeconds:f.timestampSeconds,contentHash:f.contentHash,sizeBytes:f.sizeBytes,width:f.width,height:f.height,contentType:f.contentType}))};
  assert.equal(await authorize('owner',input),true);assert.equal(await authorize('foreign',input),false);assert.equal(await authorize('owner',{...input,media:[{...input.media[0],contentHash:'d'.repeat(64)}]}),false);
  assert.equal(await frames.cleanup({...request,asset:ready}),true);for(const key of frames.keys(ready))assert.equal(await disk.driver.verifyUpload({storageKey:key}),null);
  assert.ok((await disk.driver.verifyUpload({storageKey})).exists);assert.equal((await repo.getSellingFrameJob('owner',businessId,'video1')).state,'deleted');
  t.diagnostic(JSON.stringify({realFrameProcessingMs:first.metrics.durationMs,frames:4,outputBytes:first.metrics.outputBytes,modelInvocations:0}));
 }finally{await client.close();await fs.rm(dir,{recursive:true,force:true});await fs.rm(disk.root,{recursive:true,force:true});}
});
test('Preview isolation diagnostic authenticates without importing or touching SQL',async()=>{
 const {createHandler}=require('../api/_lib/selling-isolation');
 const env={VERCEL_ENV:'preview',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',VERCEL_GIT_COMMIT_REF:'fixture',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'fixture',DEMEOS_SELLING_TEST_DATABASE_HOST:'preview.invalid',POSTGRES_URL:'postgres://fixture:fixture@preview.invalid/db',DEMEOS_SELLING_TEST_AUTHORIZATIONS:JSON.stringify([{businessId:'test-business-one',ownerIdentityId:'owner'}])};
 const call=async(identity,changes={})=>{const res={setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;return this;}};await createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,environment:()=>({...env,...changes})})({method:'GET',query:{businessId:'test-business-one'}},res);return res;};
 assert.equal((await call(null)).code,401);assert.equal((await call('foreign')).code,403);assert.equal((await call('owner',{VERCEL_ENV:'production'})).code,404);assert.equal((await call('owner',{POSTGRES_URL:'postgres://fixture:fixture@production.invalid/db'})).code,409);
 const success=await call('owner');assert.equal(success.code,200);assert.equal(success.body.databaseAccessed,false);assert.equal(JSON.stringify(success.body).includes('preview.invalid'),false);assert.equal(JSON.stringify(success.body).includes('postgres://'),false);
});
test('frame leases recover expired native work, fence stale saves and bound retries',async()=>{
 const client=new PGlite(),db=createDatabase(client),repo=createPersistenceRepository(db);
 try{
  const businessId='lease-shop',product={businessId,productId:'p1',mediaGallery:{assetIds:['v1']}},profile={businessId,products:[product]};
  await repo.createBusinessForOwner('owner',profile);const saved=(await repo.getKnownBusiness(businessId)).businessProfile;
  const asset=await repo.saveBusinessMediaAsset(businessId,{businessId,assetId:'v1',relatedEntityId:'p1',purpose:'product',kind:'video',state:'ready',width:320,height:180,durationSeconds:2,processedStorageKey:'businesses/lease-shop/media/v1/processed/master.mp4'}),hash=frames.revision(asset);
  assert.equal(await repo.claimSellingFrameJob('foreign',saved,product,asset,hash),null);
  const first=await repo.claimSellingFrameJob('owner',saved,product,asset,hash);assert.ok(first.lease_id);
  assert.equal(await frames.cleanup({store:repo,identity:'owner',asset,backend:{}}),false);
  await db.query("UPDATE demeos_media_frame_jobs SET updated_at=NOW()-INTERVAL '6 minutes'");
  await repo.reconcileSellingFrameJobs('foreign',businessId);assert.equal((await repo.getSellingFrameJob('owner',businessId,'v1')).state,'running');
  const second=await repo.claimSellingFrameJob('owner',saved,product,asset,hash);assert.notEqual(second.lease_id,first.lease_id);
  assert.equal(await repo.saveSellingVideoFrames('owner',saved,product,asset,hash,{}, {},first.lease_id),false);
  await repo.failSellingFrameJob('owner',businessId,'v1',hash,{},first.lease_id);assert.equal((await repo.getSellingFrameJob('owner',businessId,'v1')).state,'running');
  await repo.failSellingFrameJob('owner',businessId,'v1',hash,{cleanupPending:true},second.lease_id);
  const third=await repo.claimSellingFrameJob('owner',saved,product,asset,hash);assert.ok(third);
  await repo.failSellingFrameJob('owner',businessId,'v1',hash,{},third.lease_id);assert.equal(await repo.claimSellingFrameJob('owner',saved,product,asset,hash),null);
  const cleanup=await repo.beginSellingFrameCleanup('owner',businessId,'v1');assert.ok(cleanup);assert.equal(await repo.claimSellingFrameJob('owner',saved,product,asset,hash),null);
  await repo.clearSellingFrameJob('owner',businessId,'v1',cleanup.lease_id);assert.equal((await repo.getSellingFrameJob('owner',businessId,'v1')).state,'deleted');
  const events=(await db.query('SELECT state FROM demeos_media_frame_events')).rows.map(r=>r.state);assert.deepEqual(events.sort(),['deleted','expired','failed','failed'].sort());
 }finally{await client.close();}
});
