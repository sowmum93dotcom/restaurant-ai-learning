'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
const {diskStorage}=require('../browser-checks/support/private-object-store');
const copy=require('../js/selling-dashboard-copy'),shared=require('../js/demeos-language-registry');
test('Selling has the nine established locales plus Turkish, complete copy and preserved placeholders',()=>{
 assert.deepEqual(copy.languages.map(l=>l.code),[...shared.languages.map(l=>l.code),'tr']);
 for(const locale of copy.languages){
  assert.deepEqual(Object.keys(copy.packs[locale.code]),Object.keys(copy.packs.en));
  for(const [key,value] of Object.entries(copy.packs[locale.code])){
   assert.ok(value.trim(),locale.code+': '+key);
   assert.deepEqual(value.match(/\{\w+\}/g)||[],key.match(/\{\w+\}/g)||[]);
  }
  if(locale.code!=='en')assert.notEqual(copy.translate(locale.code,'Save product'),'Save product',locale.code);
 }
});
test('Selling links stay in Selling and all initial interface copy is covered',()=>{
 const html=fs.readFileSync('selling-dashboard.html','utf8');
 assert.doesNotMatch(html,/marketing\.html|business-workspace\.html/);
 const texts=Array.from(html.matchAll(/>([^<>]+)</g),m=>m[1].trim()).filter(Boolean);
 const submission=require('../js/selling-submission-copy');
 const allowed=new Set(['English','Türkçe','DEMEOS Selling','SKU','DEMEOS logo']);
 for(const text of texts){const decoded=text.replaceAll('&amp;','&');assert.ok(copy.packs.en[decoded]||copy.aliases[decoded]||Object.values(submission.en).includes(decoded)||allowed.has(decoded)||decoded==='Saving does not publish. Required checks must pass before publication readiness.','Missing copy: '+decoded);}
});
test('contact edits and resumed verified binary uploads enforce SQL ownership in live and isolated Preview',async t=>{
 const db=new PGlite(),disk=await diskStorage();let env;
 const repo=createPersistenceRepository(createDatabase(db),{environment:()=>env}),secret=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;
 process.env.DEMEOS_MEDIA_UPLOAD_SECRET='selling-repair-fixture-at-least-32-characters';
 try{for(const isolated of [false,true])await t.test(isolated?'Preview':'live',async()=>{
  const businessId=isolated?'test-business-repair':'real-repair',owner='repair-owner';
  env=isolated?{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/selling-foundation-phase-1',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'rebuild/selling-foundation-phase-1',POSTGRES_URL:'postgres://fixture@isolated.example/db',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_SELLING_TEST_AUTHORIZATIONS:JSON.stringify([{businessId,ownerIdentityId:owner}])}:{VERCEL_ENV:'production'};
  env.DEMEOS_MEDIA_UPLOAD_SECRET=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;
  await repo.createBusinessForOwner(owner,{businessId,name:'Repair business',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:isolated?undefined:{selling:true},customerContinuation:{routes:[],bookingLink:'https://example.test/booking'},products:[]});
  const saved=async()=>(await repo.getKnownBusiness(businessId)).businessProfile;
  async function call(action,product,body={},identity=owner){const res={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};await createHandler({repository:()=>repo,environment:()=>env,mediaBackend:()=>disk,authenticate:async()=>({trustedIdentityId:identity})})({method:'POST',query:{businessId},body:{action,product,catalogueRevision:catalogueRevision(await saved()),...body}},res);return res;}
  const details={name:'Repair shop',location:'London',productsServices:'Real fixture description',customerContinuation:{email:'seller@example.test',phone:'+44 20 7946 0123',website:'https://example.test'}};
  assert.equal((await call('save-business-details',null,{details,ownerAccuracyConfirmed:true})).code,200);
  assert.equal((await saved()).customerContinuation.email,details.customerContinuation.email);
  assert.equal((await saved()).customerContinuation.bookingLink,'https://example.test/booking');
  assert.deepEqual((await saved()).customerContinuation.routes,[],'Contact editing cannot grant customer continuation routes');
  assert.equal((await call('save-business-details',null,{details:{...details,customerContinuation:{...details.customerContinuation,website:'javascript:alert(1)'}},ownerAccuracyConfirmed:true})).code,400);
  assert.equal((await call('save-business-details',null,{details:{...details,applicationAccess:{selling:true}},ownerAccuracyConfirmed:true})).code,400);
  assert.equal((await call('save-business-details',null,{details,ownerAccuracyConfirmed:true},'another-owner')).code,403);
  assert.equal((await call('save-product',{productId:'repair-product',name:'Coffee',description:'Fresh beans',priceMode:'contact',price:'',availability:'contact'})).code,200);
  const bytes=await require('sharp')({create:{width:20,height:16,channels:3,background:'#06172d'}}).png().toBuffer();
  const asset={productId:'repair-product',assetId:'media-repair-'+(isolated?'test':'live'),kind:'image',contentType:'image/png',sizeBytes:bytes.length};
  const registered=await call('register-media',asset);assert.equal(registered.code,201);
  assert.equal((await call('resume-media',asset)).code,409,'Pending files cannot bypass upload verification');
  await disk.fetchImpl(registered.body.uploadSession.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes});
  // Simulate a request ending after verified upload and atomic enqueue, before the worker ran.
  const processing=await require('../api/_lib/media-upload-completion').completeVerifiedMediaUpload({asset:await repo.getBusinessMediaAsset(businessId,asset.assetId),businessId,assetId:asset.assetId,uploadToken:registered.body.uploadSession.uploadToken,storageKey:registered.body.uploadSession.storageKey,storageAdapter:disk.adapter});
  await require('../api/_lib/media-processing-queue').enqueueVerifiedMediaForProcessing(repo,processing);

  const claimed=await repo.claimNextMediaProcessingJob(5,businessId,asset.assetId);assert.ok(claimed);
  await db.query("UPDATE demeos_media_processing_jobs SET claimed_at=NOW()-INTERVAL '20 minutes' WHERE job_id=$1",[claimed.job_id]);
  assert.equal((await call('resume-media',asset,{},'another-owner')).code,403);
  assert.equal((await call('resume-media',asset)).code,200);
  const ready=await repo.getBusinessMediaAsset(businessId,asset.assetId);assert.equal(ready.state,'ready');assert.ok(ready.width&&ready.derivatives.length);
  assert.ok((await saved()).products[0].mediaGallery.assetIds.includes(asset.assetId));
  assert.equal((await call('resume-media',asset)).code,200,'Resume replay safely preserves ready linked media');
  assert.equal((await saved()).products[0].customerVisible,false,'Recovery never publishes media or product');
 });}finally{if(secret===undefined)delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;else process.env.DEMEOS_MEDIA_UPLOAD_SECRET=secret;await db.close();await fs.promises.rm(disk.root,{recursive:true,force:true});}
});

test('Selling authentication reuses existing locale resources and includes Turkish without altering Customer files',()=>{
 for(const {code} of copy.languages){const locale=require(code==='tr'?'../js/selling-auth-tr.json':'../js/customer-auth-locales/'+code+'.json');
  assert.ok(locale.locale.startsWith(code));
  for(const key of ['formButtonPrimary','formFieldLabel__emailAddress','formFieldLabel__password'])assert.ok(locale[key]);
  for(const section of ['signIn','signUp'])assert.ok(locale[section].start.title);
 }
 const tr=require('../js/selling-auth-tr.json');assert.notEqual(tr.signIn.start.title,require('../js/customer-auth-locales/en.json').signIn.start.title);
});
