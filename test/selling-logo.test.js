'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {PGlite}=require('@electric-sql/pglite'),sharp=require('sharp');
const {createDatabase}=require('../api/_lib/database');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard');
const {catalogueRevision}=require('../api/_lib/vendor-inventory');
const {diskStorage}=require('../browser-checks/support/private-object-store');
function response(){return {setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('business logo uses actual decoded bytes, SQL ownership, replacement, removal and reload without touching product media',async()=>{
 const client=new PGlite(),disk=await diskStorage({blobProtocol:true}),oldSecret=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;
 process.env.DEMEOS_MEDIA_UPLOAD_SECRET='logo-test-secret-at-least-thirty-two-characters';
 let env={VERCEL_ENV:'production',DEMEOS_MEDIA_UPLOAD_SECRET:process.env.DEMEOS_MEDIA_UPLOAD_SECRET};
 const repo=createPersistenceRepository(createDatabase(client),{environment:()=>env});
 try{
  for(const preview of [false,true]){
   const id=preview?'test-business-logo-shop':'logo-shop';
   env=preview?{...env,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/selling-foundation-phase-1',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'rebuild/selling-foundation-phase-1',POSTGRES_URL:'postgres://fixture@isolated.example/db',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_SELLING_TEST_AUTHORIZATIONS:JSON.stringify([{businessId:id,ownerIdentityId:'owner'}])}:env;
   const profile={businessId:id,name:'Saved Shop',type:'Retail',location:'London',preparationModel:'selling',productsServices:'Saved description',customerContinuation:{email:'shop@example.com'},applicationAccess:preview?undefined:{selling:true},products:[]};
   await repo.createBusinessForOwner('owner',profile);
   async function call(action,logo,identity='owner',revision){const current=(await repo.getKnownBusiness(id)).businessProfile,res=response();await createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,environment:()=>env,repository:()=>repo,mediaBackend:()=>disk})({method:action?'POST':'GET',query:{businessId:id},body:{action,logo,catalogueRevision:revision||catalogueRevision(current)}},res);return res;}
   const bytes=await sharp({create:{width:24,height:16,channels:3,background:'#1b3760'}}).png().toBuffer();
   const item={assetId:'media-logo-'+id,kind:'image',contentType:'image/png',sizeBytes:bytes.length};
   assert.equal((await call('register-logo',item,'other')).statusCode,403);
   assert.equal((await call('register-logo',item,null)).statusCode,401);
   assert.equal((await call('register-logo',{...item,kind:'video',contentType:'video/mp4'})).statusCode,400);
   assert.equal((await call('register-logo',item,'owner','stale')).statusCode,409);
   async function upload(data){const registered=await call('register-logo',data);assert.equal(registered.statusCode,201);const u=registered.body.uploadSession;const completion={assetId:registered.body.assetId,storageKey:u.storageKey,uploadToken:u.uploadToken};assert.equal((await call('complete-logo',completion)).statusCode,409);const transfer=await disk.fetchImpl(u.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png',...u.headers},body:bytes});assert.equal(transfer.ok,true);assert.equal((await call('complete-logo',completion)).statusCode,200);return completion;}
   const first=await upload(item);
   let view=(await call()).body.business;
   assert.equal(view.logo.assetId,item.assetId);assert.ok(view.logo.previewUrl);assert.deepEqual(view.products,[]);assert.deepEqual(view.media,[]);assert.equal(view.identity.name,'Saved Shop');assert.equal(view.identity.contact.email,'shop@example.com');
   assert.equal((await call('complete-logo',first)).statusCode,200,'lost completion response is safe to retry');
   const withDraft=(await repo.getKnownBusiness(id)).businessProfile;
   await repo.saveSellingProducts('owner',id,withDraft,{...withDraft,products:[{businessId:id,productId:'draft',name:'',description:'',priceMode:'contact',price:'',customerVisible:false}]});
   const current=(await repo.getKnownBusiness(id)).businessProfile,saved=response();
   await createHandler({authenticate:async()=>({trustedIdentityId:'owner'}),environment:()=>env,repository:()=>repo,mediaBackend:()=>disk})({method:'POST',query:{businessId:id},body:{action:'save-business-details',catalogueRevision:catalogueRevision(current),ownerAccuracyConfirmed:true,details:{name:'Saved Shop Updated',businessAddress:{countryCode:'GB',addressLine1:'10 Market Street',addressLine2:'',locality:'London',region:'',postalCode:''},serviceArea:'',productsServices:'Updated facts',customerContinuation:{email:'shop@example.com',phone:'',website:''}}}},saved);
   assert.equal(saved.statusCode,200,'Unchanged incomplete drafts do not block business profile edits');
   const afterEdit=(await repo.getKnownBusiness(id)).businessProfile;assert.equal(afterEdit.logoAssetId,item.assetId);assert.equal(afterEdit.products[0].name,'');assert.equal(afterEdit.name,'Saved Shop Updated');

   const next={...item,assetId:item.assetId+'-replacement'};
   assert.equal((await call('register-logo',next)).statusCode,201);
   assert.equal((await call()).body.business.logo.assetId,item.assetId,'pending replacement preserves current logo');
   await upload(next);
   assert.equal((await repo.getBusinessMediaAsset(id,item.assetId)).state,'archived');
   assert.equal((await call('remove-logo',{assetId:item.assetId})).statusCode,409,'stale removal cannot remove replacement');
   assert.equal((await call('remove-logo',{assetId:next.assetId},'other')).statusCode,403);
   assert.equal((await call('remove-logo',{assetId:next.assetId})).statusCode,200);
   assert.equal((await call()).body.business.logo,null);assert.equal((await repo.getBusinessMediaAsset(id,next.assetId)).state,'archived');
   assert.equal((await repo.getKnownBusiness(id)).businessProfile.products[0].productId,'draft');
   if(preview){env={...env,VERCEL_ENV:'production'};assert.equal((await call()).statusCode,503);}
  }
 }finally{if(oldSecret===undefined)delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;else process.env.DEMEOS_MEDIA_UPLOAD_SECRET=oldSecret;await client.close();await fs.rm(disk.root,{recursive:true,force:true});}
});
