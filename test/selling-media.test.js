'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {PGlite}=require('@electric-sql/pglite'),sharp=require('sharp');
const {createDatabase}=require('../api/_lib/database');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard');
const {catalogueRevision}=require('../api/_lib/vendor-inventory');
const {createMediaStorageAdapter}=require('../api/_lib/media-storage-adapter');
const {createSharpMediaDrivers}=require('../api/_lib/media-sharp-driver');
// Actual binary files on disk emulate the private object-store boundary only.
// The shipped handler, upload verification, decoder, optimizer, worker and SQL run unchanged.
const {diskStorage}=require('../browser-checks/support/private-object-store');
function response(){return {setHeader(){},status(status){this.statusCode=status;return this;},json(body){this.body=body;return this;}};}
test('actual image bytes upload, decode, persist, reload and unlink through one live/Preview handler',async()=>{
 const disk=await diskStorage(),client=new PGlite();let env;
 const repository=createPersistenceRepository(createDatabase(client),{environment:()=>env});
 const before=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;process.env.DEMEOS_MEDIA_UPLOAD_SECRET='test-upload-secret-at-least-thirty-two-characters';
 const secret=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;
 try{
  for(const preview of [false,true]){
   const businessId=preview?'test-business-media':'live-media';
   env=preview?{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/selling-foundation-phase-1',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'rebuild/selling-foundation-phase-1',POSTGRES_URL:'postgres://fixture@isolated.example/db',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_SELLING_TEST_AUTHORIZATIONS:JSON.stringify([{businessId,ownerIdentityId:'owner-a'}]),DEMEOS_MEDIA_UPLOAD_SECRET:secret}:{VERCEL_ENV:'production',DEMEOS_MEDIA_UPLOAD_SECRET:secret};
   await repository.createBusinessForOwner('owner-a',{businessId,name:'Media Shop',applicationAccess:preview?undefined:{selling:true},products:[{businessId,productId:'coffee',name:'Coffee',description:'Beans',priceMode:'contact',price:'',customerVisible:false},{businessId,productId:'tea',name:'Tea'}]});
   async function call(action,product,identity='owner-a',method='POST'){
    const current=(await repository.getKnownBusiness(businessId)).businessProfile,res=response();
    await createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,environment:()=>env,repository:()=>repository,mediaBackend:()=>disk})
     ({method,query:{businessId},body:{action,product,catalogueRevision:catalogueRevision(current)}},res);return res;
   }
   const bytes=await sharp({create:{width:16,height:12,channels:3,background:'#0b2b52'}}).png().toBuffer();
   const item={productId:'coffee',assetId:'media-'+businessId,kind:'image',contentType:'image/png',sizeBytes:bytes.length};
   assert.equal((await call('register-media',item,'owner-b')).statusCode,403);
   assert.equal((await call('register-media',{...item,contentType:'image/svg+xml'})).statusCode,400);
   assert.equal((await call('register-media',{...item,sizeBytes:20*1024*1024})).statusCode,400);
   assert.equal((await call('register-media',{...item,kind:'video',contentType:'video/mp4'})).statusCode,503,'No pretend video transcoder');
   const registered=await call('register-media',item);assert.equal(registered.statusCode,201);
   assert.equal((await repository.getBusinessMediaAsset(businessId,item.assetId)).state,'pending-upload');
   const upload=registered.body.uploadSession;
   assert.equal((await call('complete-media',{productId:'coffee',assetId:item.assetId,storageKey:upload.storageKey,uploadToken:upload.uploadToken})).statusCode,409,'Metadata alone is not an uploaded file');
   await disk.fetchImpl(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes});
   const completion={productId:'coffee',assetId:item.assetId,storageKey:upload.storageKey,uploadToken:upload.uploadToken};
   assert.equal((await call('complete-media',{...completion,productId:'tea'})).statusCode,404,'Exact product relationship enforced');
   assert.equal((await call('complete-media',completion)).statusCode,200);
   const asset=await repository.getBusinessMediaAsset(businessId,item.assetId);assert.equal(asset.state,'ready');assert.equal(asset.derivatives.length,3);
   const processed=await fs.readFile(disk.file(asset.processedStorageKey));assert.equal((await sharp(processed).metadata()).format,'webp');
   let stored=(await repository.getKnownBusiness(businessId)).businessProfile;
   assert.deepEqual(stored.products[0].mediaGallery,{assetIds:[item.assetId],mainAssetId:item.assetId});assert.equal(stored.products[0].customerVisible,false);
   assert.equal((await call('complete-media',completion)).statusCode,200,'Completed upload retry is idempotent');
   const reloaded=await call(null,null,'owner-a','GET');assert.equal(reloaded.statusCode,200);
   assert.equal(reloaded.body.business.media[0].linked,true);assert.ok(reloaded.body.business.media[0].previewUrl);
   const second={...item,assetId:item.assetId+'-second'};
   const secondUpload=(await call('register-media',second)).body.uploadSession;
   await disk.fetchImpl(secondUpload.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes});
   assert.equal((await call('complete-media',{productId:'coffee',assetId:second.assetId,storageKey:secondUpload.storageKey,uploadToken:secondUpload.uploadToken})).statusCode,200);
   assert.equal((await call('move-media',{productId:'coffee',assetId:second.assetId,direction:'earlier'},'owner-b')).statusCode,403);
   assert.equal((await call('move-media',{productId:'tea',assetId:second.assetId,direction:'earlier'})).statusCode,400);
   assert.equal((await call('move-media',{productId:'coffee',assetId:second.assetId,direction:'earlier'})).statusCode,200);
   const ordered=(await repository.getKnownBusiness(businessId)).businessProfile.products[0].mediaGallery;
   assert.deepEqual(ordered.assetIds,[second.assetId,item.assetId]);assert.equal(ordered.mainAssetId,item.assetId,'Ordering preserves the main image');
   assert.equal((await call(null,null,'owner-a','GET')).body.business.media[0].assetId,second.assetId);
   assert.equal((await call('remove-media',{productId:'coffee',assetId:second.assetId})).statusCode,200);
   assert.equal((await call('remove-media',{productId:'coffee',assetId:item.assetId},'owner-b')).statusCode,403);
   assert.equal((await call('remove-media',{productId:'tea',assetId:item.assetId})).statusCode,404);
   assert.equal((await call('remove-media',{productId:'coffee',assetId:item.assetId})).statusCode,200);
   assert.equal((await repository.getBusinessMediaAsset(businessId,item.assetId)).state,'archived');
   stored=(await repository.getKnownBusiness(businessId)).businessProfile;assert.deepEqual(stored.products[0].mediaGallery.assetIds,[]);
   assert.deepEqual((await call(null,null,'owner-a','GET')).body.business.media,[],'Removal survives reload');
   if(preview){env={...env,VERCEL_ENV:'production'};assert.equal((await call('register-media',item)).statusCode,503);}
  }
 }finally{if(before===undefined)delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;else process.env.DEMEOS_MEDIA_UPLOAD_SECRET=before;await client.close();await fs.rm(disk.root,{recursive:true,force:true});}
});
test('decoder rejects disguised unsafe bytes rather than claiming ready',async()=>{
 const disk=await diskStorage();try{
  const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),key='bad-file';
  await disk.fetchImpl('https://storage.gate/'+key,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes});
  await assert.rejects(disk.drivers.inspectImage({kind:'image',contentType:'image/png',sizeBytes:bytes.length},{sourceUrl:'https://storage.gate/'+key}));
 }finally{await fs.rm(disk.root,{recursive:true,force:true});}
});

