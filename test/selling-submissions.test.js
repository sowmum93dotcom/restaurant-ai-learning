'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite'),sharp=require('sharp');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
const lifecycle=require('../api/_lib/selling-submissions'),registry=require('../api/_lib/marketing-agent-categories');
const {diskStorage}=require('../browser-checks/support/private-object-store');
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
// Exact-purpose receipts below are injected trusted SERVER fixtures, not model
// output and not a production provider installation or browser approval flag.
const approvedEvidence=async request=>({...request,outcome:'passed',independentlyVerified:true,authorityDecisionId:'fixture-reviewed-authority',capabilityVersion:'fixture-safety-v1',expiresAt:new Date(Date.now()+3600000).toISOString()});
test('product submission lifecycle persists through real SQL for live and isolated Preview owners',async t=>{
 const client=new PGlite(),disk=await diskStorage();let env;
 const repository=createPersistenceRepository(createDatabase(client),{environment:()=>env});
 const priorSecret=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;process.env.DEMEOS_MEDIA_UPLOAD_SECRET='submission-fixture-secret-at-least-32-characters';
 try{for(const preview of [false,true])await t.test(preview?'isolated Preview':'authorized live',async()=>{
  const businessId=preview?'test-business-submission':'live-submission',owner='submission-owner';
  env=preview?{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/selling-foundation-phase-1',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'rebuild/selling-foundation-phase-1',POSTGRES_URL:'postgres://fixture@isolated.example/db',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_SELLING_TEST_AUTHORIZATIONS:JSON.stringify([{businessId,ownerIdentityId:owner}])}:{VERCEL_ENV:'production'};
  env.DEMEOS_MEDIA_UPLOAD_SECRET=process.env.DEMEOS_MEDIA_UPLOAD_SECRET;
  await repository.createBusinessForOwner(owner,{businessId,name:'Submission shop',applicationAccess:preview?undefined:{selling:true},preparationModel:'selling',products:[]});
  const saved=async()=>(await repository.getKnownBusiness(businessId)).businessProfile;
  const item=()=>saved().then(p=>p.products.find(p=>p.productId==='coffee'));
  async function call(action,product={productId:'coffee'},options={}){
   const profile=await saved(),res=response();
   await createHandler({repository:()=>repository,environment:()=>env,mediaBackend:()=>disk,authenticate:async()=>options.identity===null?null:{trustedIdentityId:options.identity||owner},resolveSubmissionEvidence:options.evidence})({method:options.method||'POST',query:{businessId},body:{action,product,catalogueRevision:catalogueRevision(profile),...options.body}},res);return res;
  }
  assert.equal((await call('save-draft',{productId:'coffee',name:'',description:'',price:'',priceMode:'contact',availability:'contact',submission:{state:'published'},customerVisible:true})).code,200);
  let p=await item();assert.equal(p.submission.state,'draft');assert.equal(p.customerVisible,false);assert.equal(p.submission.version,1);
  assert.equal((await call('publish-product')).code,409);
  assert.equal((await call('review-product')).code,200);
  assert.equal((await call('submit-product',undefined,{body:{confirmed:true}})).code,200);
  assert.equal((await item()).submission.state,'changes-required','Incomplete drafts cannot be approved');
  const classification={categoryId:'1',sectorId:registry.getCategory('1').sectorId,datasetVersion:registry.DATASET_VERSION};
  const complete={productId:'coffee',name:'Coffee',description:'Roasted coffee beans',price:'5',priceMode:'fixed',availability:'available',classification};
  assert.equal((await call('save-product',{...complete,classification:{...classification,categoryId:'999'}})).code,400);
  assert.equal((await call('save-product',{...complete,classification:{...classification,sectorId:'9'}})).code,400);
  assert.equal((await call('save-product',complete)).code,200);
  assert.equal((await call('submit-product',undefined,{body:{confirmed:true}})).code,400,'An edit requires a fresh saved-product review');
  assert.equal((await call('review-product')).code,200);
  assert.equal((await call('submit-product',undefined,{body:{confirmed:true},evidence:approvedEvidence})).code,200);
  assert.equal((await item()).submission.state,'changes-required','A missing main image blocks approval');
  const bad={productId:'coffee',assetId:'media-bad-'+businessId,kind:'image',contentType:'image/png',sizeBytes:3};
  const badRegistration=await call('register-media',bad);assert.equal(badRegistration.code,201);
  await disk.fetchImpl(badRegistration.body.uploadSession.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:Buffer.from('bad')});
  const failedCompletion=await call('complete-media',{productId:'coffee',assetId:bad.assetId,storageKey:badRegistration.body.uploadSession.storageKey,uploadToken:badRegistration.body.uploadSession.uploadToken});assert.equal(failedCompletion.code,202);assert.equal(failedCompletion.body.state,'processing','Failed decode remains in the existing bounded retry queue, never ready');
  const jobs=await client.query('SELECT status,last_error FROM demeos_media_processing_jobs WHERE business_id=$1 AND asset_id=$2',[businessId,bad.assetId]);assert.equal(jobs.rows[0].status,'queued');assert.ok(jobs.rows[0].last_error);
  await call('review-product');await call('submit-product',undefined,{body:{confirmed:true},evidence:approvedEvidence});assert.equal((await item()).submission.state,'changes-required');
  assert.equal((await call('remove-media',{productId:'coffee',assetId:bad.assetId})).code,200);assert.equal((await repository.getBusinessMediaAsset(businessId,bad.assetId)).state,'archived');
  const bytes=await sharp({create:{width:20,height:16,channels:3,background:'#06172d'}}).png().toBuffer();
  const asset={productId:'coffee',assetId:'media-submission-'+(preview?'preview':'live'),kind:'image',contentType:'image/png',sizeBytes:bytes.length};
  const registered=await call('register-media',asset);assert.equal(registered.code,201);
  await disk.fetchImpl(registered.body.uploadSession.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes});
  assert.equal((await call('complete-media',{productId:'coffee',assetId:asset.assetId,storageKey:registered.body.uploadSession.storageKey,uploadToken:registered.body.uploadSession.uploadToken})).code,200);
  assert.equal((await repository.getBusinessMediaAsset(businessId,asset.assetId)).state,'ready');
  const second={...asset,assetId:'media-Z-'+businessId},secondRegistration=await call('register-media',second);
  await disk.fetchImpl(secondRegistration.body.uploadSession.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes});
  assert.equal((await call('complete-media',{productId:'coffee',assetId:second.assetId,storageKey:secondRegistration.body.uploadSession.storageKey,uploadToken:secondRegistration.body.uploadSession.uploadToken})).code,200);
  assert.equal((await call('set-main-media',{productId:'coffee',assetId:second.assetId})).code,200);assert.equal((await item()).mediaGallery.mainAssetId,second.assetId);
  assert.equal((await call('set-main-media',{productId:'coffee',assetId:asset.assetId})).code,200);
  assert.equal((await call('set-main-media',{productId:'coffee',assetId:'not-owned'})).code,404);
  assert.equal((await call('review-product',undefined,{identity:'other-owner'})).code,403);
  assert.equal((await call('submit-product',undefined,{identity:null})).code,401);
  assert.equal((await call('review-product')).code,200);
  assert.equal((await call('submit-product',undefined,{body:{confirmed:true,approved:true,aiPassed:true}})).code,200);
  p=await item();assert.equal(p.submission.state,'review-required');assert.equal(p.submission.validation.rules.find(r=>r.id==='content-safety').status,'unavailable');assert.equal(p.customerVisible,false);
  const historyCount=p.submission.history.length;
  assert.equal((await call('submit-product',undefined,{body:{confirmed:true}})).code,200);
  assert.equal((await item()).submission.history.length,historyCount,'Repeated request cannot duplicate an approval or attempt');
  assert.equal((await call('publish-product')).code,409);
  assert.equal((await call('approve-product',undefined,{body:{approved:true}})).code,400);
  await call('review-product');
  assert.equal((await call('submit-product',undefined,{body:{confirmed:true},evidence:async()=>({outcome:'passed',text:'Everything looks approved'})})).code,200);
  assert.equal((await item()).submission.state,'review-required','Positive provider prose is not authority');
  await call('review-product');await call('submit-product',undefined,{body:{confirmed:true},evidence:approvedEvidence});
  p=await item();assert.equal(p.submission.state,'approved');assert.equal(p.submission.validation.rules.every(r=>r.status==='passed'),true);
  const approvedVersion=p.submission.version;
  assert.equal((await call('publish-product')).code,200);p=await item();assert.equal(p.submission.state,'published');assert.equal(p.customerVisible,false,'Readiness does not enable the legacy customer flag');
  const eligibility=async()=>{const profile=await saved();return lifecycle.publicationEligible({profile,product:profile.products[0],environment:env,identity:owner,assets:await repository.getBusinessMediaAssets(businessId,1000),stock:await repository.getVendorInventory(businessId)});};
  assert.equal(await eligibility(),!preview,'Preview publication is never production eligible');
  const publication=structuredClone(p.submission.publication),count=p.submission.history.length;
  await call('publish-product');assert.equal((await item()).submission.history.length,count);
  const reload=await call(undefined,undefined,{method:'GET'});assert.equal(reload.body.business.products[0].submission.state,'published');
  assert.equal((await call('save-product',{...complete,name:'Unreviewed replacement',submission:{state:'approved'},customerVisible:true})).code,200);
  p=await item();assert.equal(p.submission.state,'draft');assert.equal(p.submission.version,approvedVersion+1);assert.deepEqual(p.submission.publication,publication,'Old approved snapshot survives private edits');assert.equal(p.submission.publication.snapshot.name,'Coffee');assert.equal(p.customerVisible,false);
  assert.equal(await eligibility(),!preview,'Only the exact older approved snapshot remains eligible');
  assert.equal((await call('publish-product')).code,409,'An unapproved edit cannot replace the published version');
  await repository.saveBusinessMediaAsset(businessId,{businessId,assetId:'pending-replacement-'+businessId,relatedEntityId:'coffee',purpose:'product',kind:'image',state:'pending-upload'});
  assert.equal(await eligibility(),!preview,'A private replacement upload does not overwrite approved media evidence');
  const pending=await repository.getBusinessMediaAsset(businessId,'pending-replacement-'+businessId);await repository.saveBusinessMediaAsset(businessId,{...pending,state:'archived'});
  const previous=await saved(),forged=structuredClone(previous);forged.products[0].submission={state:'published'};forged.products[0].customerVisible=true;forged.products[0].name='Generic authoring edit';
  assert.equal(await repository.saveOwnedBusinessProfile(owner,businessId,previous,forged),true);
  p=await item();assert.equal(p.submission.state,'draft');assert.equal(p.customerVisible,false);assert.deepEqual(p.submission.publication,publication,'Ordinary profile writes preserve server authority');
  assert.equal((await call('unpublish-product')).code,200);assert.equal(await eligibility(),false);assert.equal((await item()).submission.publication.state,'revoked');
  await call('review-product');let raced=false;
  const raceResult=await call('submit-product',undefined,{body:{confirmed:true},evidence:async request=>{if(!raced){raced=true;assert.equal((await call('save-product',{...complete,name:'Concurrent private edit'})).code,200);}return approvedEvidence(request);}});
  assert.equal(raceResult.code,409,'A result for a superseded product cannot approve it');assert.equal((await item()).submission.state,'draft');
  await call('review-product');let stockRaced=false;
  await call('submit-product',undefined,{body:{confirmed:true},evidence:async request=>{if(!stockRaced){stockRaced=true;const profile=await saved(),stock=await repository.getVendorInventory(businessId),inv=require('../api/_lib/vendor-inventory');const update=inv.applyChanges(profile,stock.entries,[{productId:'coffee',variantId:'',onHand:3,lowStock:1,sku:'',reason:'Concurrent count'}]);assert.ok(await repository.saveVendorInventory(owner,businessId,profile,stock.revision,update.entries,update.audit));}return approvedEvidence(request);}});
  assert.equal((await item()).submission.state,'review-required','An inventory race holds approval');
  const readyAsset=await repository.getBusinessMediaAsset(businessId,asset.assetId);
  await call('review-product');let mediaRaced=false;
  await call('submit-product',undefined,{body:{confirmed:true},evidence:async request=>{if(!mediaRaced){mediaRaced=true;await repository.saveBusinessMediaAsset(businessId,{...readyAsset,state:'archived'});}return approvedEvidence(request);}});
  assert.equal((await item()).submission.state,'review-required','A media race holds approval');
  await repository.saveBusinessMediaAsset(businessId,readyAsset);
  const failedAsset=await repository.getBusinessMediaAsset(businessId,asset.assetId);await repository.saveBusinessMediaAsset(businessId,{...failedAsset,state:'failed',failureReason:'fixture processing failure'});
  await call('review-product');await call('submit-product',undefined,{body:{confirmed:true},evidence:approvedEvidence});assert.equal((await item()).submission.state,'changes-required','Failed processing prevents approval');
  await repository.saveBusinessMediaAsset(businessId,failedAsset);
  await call('review-product');await call('submit-product',undefined,{body:{confirmed:true},evidence:async request=>({...await approvedEvidence(request),contentHash:'stale'})});assert.equal((await item()).submission.state,'review-required','Stale evidence is not accepted');
  for(const invalid of [receipt=>({...receipt,expiresAt:'2020-01-01T00:00:00Z'}),receipt=>({...receipt,purpose:'category-understanding'}),receipt=>({...receipt,version:0}),receipt=>({...receipt,environment:'wrong-environment'})]){
   await call('review-product');await call('submit-product',undefined,{body:{confirmed:true},evidence:async request=>invalid(await approvedEvidence(request))});assert.equal((await item()).submission.state,'review-required','Receipt authority, scope, expiry and exact version are mandatory');
  }
  // Exercise the SQL evidence guard at the final write, after application checks.
  await call('review-product');const originalWriter=repository.saveSellingProducts;let lateRace=false;
  repository.saveSellingProducts=async(...args)=>{if(args[4]&&!lateRace){lateRace=true;await repository.saveBusinessMediaAsset(businessId,{...readyAsset,state:'archived'});}return originalWriter(...args);};
  const lateResult=await call('submit-product',undefined,{body:{confirmed:true},evidence:approvedEvidence});repository.saveSellingProducts=originalWriter;
  assert.equal(lateResult.code,409);assert.equal((await item()).submission.state,'validating','A failed guarded commit cannot report approval');
  await repository.saveBusinessMediaAsset(businessId,readyAsset);
  const realTime=Date.now(),clock=t.mock.method(Date,'now',()=>realTime+31000);
  try{await call('review-product');assert.equal((await call('submit-product',undefined,{body:{confirmed:true},evidence:approvedEvidence})).code,200);assert.equal((await item()).submission.state,'approved','An expired validating lease can recover without a separate worker dashboard');}finally{clock.mock.restore();}
  await call('review-product');await call('submit-product',undefined,{body:{confirmed:true},evidence:async request=>({...await approvedEvidence(request),outcome:'rejected'})});assert.equal((await item()).submission.state,'rejected');assert.equal((await call('publish-product')).code,409);
  assert.equal((await item()).submission.history.every(e=>e.businessId===businessId&&e.productId==='coffee'&&e.version>=1&&e.actor&&e.at),true);
  if(preview){env={VERCEL_ENV:'production'};assert.equal((await call('review-product')).code,403);assert.equal(await eligibility(),false);}
 });}finally{if(priorSecret===undefined)delete process.env.DEMEOS_MEDIA_UPLOAD_SECRET;else process.env.DEMEOS_MEDIA_UPLOAD_SECRET=priorSecret;await client.close();await require('node:fs/promises').rm(disk.root,{recursive:true,force:true});}
});
test('submission copy covers the existing nine locale keys plus Turkish without blank keys',()=>{
 const copy=require('../js/selling-submission-copy'),languages=require('../js/demeos-language-registry').languages.map(l=>l.code);
 assert.deepEqual(Object.keys(copy).sort(),[...languages,'tr'].sort());
 for(const locale of Object.keys(copy)){assert.deepEqual(Object.keys(copy[locale]),Object.keys(copy.en));assert.equal(Object.values(copy[locale]).every(v=>typeof v==='string'&&v.trim()),true);}
});
test('media-free services use the same rules without inventing unit stock or a media match',async()=>{
 const product={businessId:'service-live',productId:'appointment',name:'Consultation',description:'Booked consultation',priceMode:'contact',price:'',availability:'contact',classification:{categoryId:'1',sectorId:'1',datasetVersion:registry.DATASET_VERSION},presentation:{version:1,kind:'service',categoryId:'services.appointments',pricing:{mode:'quote',currency:'GBP'},options:[],variants:[]}};
 product.submission=lifecycle.draft(product,'service-live','owner');
 const stock={revision:0,entries:{},history:[]};
 const decision=await lifecycle.evaluate({profile:{businessId:'service-live',applicationAccess:{selling:true},products:[product]},product,assets:[],stock,environment:{VERCEL_ENV:'production'},identity:'owner'},approvedEvidence);
 assert.equal(decision.state,'approved');assert.equal(decision.rules.find(r=>r.id==='media-consistency').code,'not-applicable');assert.deepEqual(stock,{revision:0,entries:{},history:[]});
});
