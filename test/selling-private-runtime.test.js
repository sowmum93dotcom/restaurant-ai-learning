'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac,createHash}=require('node:crypto');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
const runtime=require('../api/_lib/selling-visual-runtime');
const secret='fixture-runtime-secret-at-least-32-characters';
const manifest={operator:'DEMEOS',modelId:runtime.MODEL,modelVersion:runtime.REVISION,weightsManifestHash:'a'.repeat(64),runtimeCodeHash:'e'.repeat(64),licenceReviewId:'fixture-licence',securityReviewId:'fixture-security',benchmarkReviewId:'fixture-benchmark',benchmarkTimeoutMs:2000,capabilities:['image-semantics','video-frame-semantics']};
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/selling-foundation-phase-1',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'rebuild/selling-foundation-phase-1',POSTGRES_URL:'postgres://fixture@isolated.example/db',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_SELLING_TEST_AUTHORIZATIONS:JSON.stringify([{businessId:'test-business-runtime',ownerIdentityId:'owner'}]),DEMEOS_VISUAL_RUNTIME_ENABLED:'true',DEMEOS_VISUAL_RUNTIME_ORIGIN:'https://gpu.demeos.example',DEMEOS_VISUAL_RUNTIME_HOST:'gpu.demeos.example',DEMEOS_VISUAL_RUNTIME_SECRET:secret,DEMEOS_VISUAL_RUNTIME_MANIFEST:JSON.stringify(manifest),DEMEOS_VISUAL_MEDIA_HOSTS:'private.demeos.example'};

test('private runtime requires isolated Preview, exact reviewed model, TLS, pinned host and benchmark attestation',()=>{
 assert.ok(runtime.configuration(env));
 for(const change of [{VERCEL_ENV:'production'},{DEMEOS_VISUAL_RUNTIME_ENABLED:'false'},{POSTGRES_URL:'postgres://fixture@main.example/db'},{DEMEOS_VISUAL_RUNTIME_ORIGIN:'http://gpu.demeos.example'},{DEMEOS_VISUAL_RUNTIME_ORIGIN:'https://user:password@gpu.demeos.example'},{DEMEOS_VISUAL_RUNTIME_HOST:'foreign.example'},{DEMEOS_VISUAL_MEDIA_HOSTS:'*.example'},{DEMEOS_VISUAL_RUNTIME_SECRET:'short'},{DEMEOS_VISUAL_RUNTIME_MANIFEST:JSON.stringify({...manifest,benchmarkReviewId:''})},{DEMEOS_VISUAL_RUNTIME_MANIFEST:JSON.stringify({...manifest,modelVersion:'unpinned'})}])assert.equal(runtime.configuration({...env,...change}),null);
});
test('stream limits cancel oversized and aborted bodies',async()=>{
 const controller=new AbortController();let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(10));},cancel(){cancelled=true;}});
 await assert.rejects(runtime.readBounded(new Response(stream),5,controller.signal));assert.equal(cancelled,true);
 const hung=new ReadableStream({cancel(){cancelled=true;}});cancelled=false;
 const pending=runtime.readBounded(new Response(hung),5,controller.signal);controller.abort();await assert.rejects(pending);assert.equal(cancelled,true);
});
test('real Python supervisor and HTTP protocol reject unauthenticated requests and terminate a hung fixture child',async()=>{
 const {stderr}=await promisify(execFile)('python3',['-m','unittest','discover','-s','tools/visual-runtime','-p','*_test.py'],{timeout:15000});
 assert.match(stderr,/OK/);
});
test('signed transport, verified bytes, SQL caching and per-proposal review preserve products and reject stale/foreign writes',async()=>{
 const db=new PGlite(),repo=createPersistenceRepository(createDatabase(db),{environment:()=>env});
 const bytes=await require('sharp')({create:{width:24,height:24,channels:3,background:'#c02020'}}).webp().toBuffer();
 const contentHash=createHash('sha256').update(bytes).digest('hex'),businessId='test-business-runtime';
 const asset={assetId:'image',businessId,relatedEntityId:'p1',purpose:'product',kind:'image',state:'ready',width:24,height:24,contentType:'image/webp',sizeBytes:bytes.length,processedSizeBytes:bytes.length,sourceHash:contentHash,processedHash:contentHash,processedStorageKey:`businesses/${businessId}/media/image/processed/master.webp`};
 const backend={driver:{createProcessingRead:async({storageKey})=>({storageKey,readUrl:'https://private.demeos.example/signed-image'})}};
 let calls=0,corrupt=false,wrongProvenance=false;
 // Declared fixture response; no model or hosted inference is used by this test.
 const fetchImpl=async(url,options)=>{
  if(url==='https://private.demeos.example/signed-image')return new Response(corrupt?Buffer.from('corrupt'):bytes);
  assert.equal(url,'https://gpu.demeos.example/v1/infer');assert.equal(options.redirect,'error');
  assert.equal(options.headers['X-DEMEOS-Signature'],createHmac('sha256',secret).update(options.body).digest('hex'));
  const body=JSON.parse(options.body);assert.equal(JSON.stringify(body).includes(secret),false);assert.equal(body.media[0],bytes.toString('base64'));
  assert.ok(body.deadline<=Date.now()+2000);calls++;
  return Response.json({protocolVersion:1,jobId:body.jobId,inputHash:body.inputHash,modelVersion:wrongProvenance?'foreign':runtime.REVISION,weightsManifestHash:manifest.weightsManifestHash,runtimeCodeHash:manifest.runtimeCodeHash,measurements:{durationMs:5,peakVramBytes:100},output:{schemaVersion:2,outputSchema:'demeos-visual-output-v2',proposals:[{kind:'title',value:'Fixture product title',evidence:[contentHash],confidence:null},{kind:'description',value:'Fixture visible description',evidence:[contentHash],confidence:null}]}});
 };
 try{
  await repo.createBusinessForOwner('owner',{businessId,preparationModel:'selling',name:'Fixture shop',type:'Shop',location:'Fixture',products:[{businessId,productId:'p1',name:'Camera',description:'Camera description',sku:'',classification:{categoryId:'11',sectorId:require('../api/_lib/marketing-agent-categories').getCategory('11').sectorId,datasetVersion:require('../api/_lib/marketing-agent-categories').DATASET_VERSION},categoryAttributes:{schemaVersion:1,byCategory:{'11':{model:'Camera',specifications:'24 MP'}}},priceMode:'contact',price:'',availability:'contact',mediaGallery:{assetIds:['image'],mainAssetId:'image'}}]});
  await repo.saveBusinessMediaAsset(businessId,asset);
  const profile=async()=>(await repo.getKnownBusiness(businessId)).businessProfile;
  const handler=createHandler({authenticate:async req=>({trustedIdentityId:req.fixtureIdentity||'owner'}),repository:()=>repo,environment:()=>env,mediaBackend:()=>backend,visualRunnerFactory:args=>runtime.createConfiguredVisualRunner({...args,fetchImpl})});
  async function call(body={},identity='owner'){
   const p=(await profile()).products[0],res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
   await handler({method:'POST',query:{businessId},fixtureIdentity:identity,body:{action:'analyze-product',productId:'p1',productRevision:catalogueRevision(p),...body}},res);return res;
  }
  const before=await profile();
  assert.equal((await call({},'foreign')).code,403);assert.equal(calls,0);
  const savedProduct=before.products[0];
  const editor={name:savedProduct.name,description:savedProduct.description,sku:'',priceMode:'contact',price:'',availability:'contact',classification:{datasetVersion:savedProduct.classification.datasetVersion,categoryId:'11',sectorId:savedProduct.classification.sectorId},categoryFields:{schemaVersion:1,categoryId:'11',datasetVersion:savedProduct.classification.datasetVersion,values:{specifications:'24 MP',model:'Camera'}}};
  const unsaved=await call({editor:{...editor,description:'Unsaved change'}});assert.equal(unsaved.body.persisted,false);assert.equal(unsaved.body.analysis.visual.code,'save-product-first');assert.equal(calls,0);
  let result=await call({editor});assert.equal(result.code,200);assert.equal(result.body.analysis.visual.status,'succeeded');assert.equal(result.body.analysis.model.available,true);assert.equal(calls,1);
  const analysis=result.body.analysis;
  assert.equal((await call()).body.cacheHit,true);assert.equal(calls,1);
  assert.equal((await call({action:'review-intelligence',inputHash:analysis.inputHash,confirmed:true})).code,409,'Cannot mark pending model proposals reviewed');
  const review=(proposal,decision,value)=>({action:'review-intelligence',inputHash:analysis.inputHash,confirmed:true,proposalId:proposal.proposalId,decision,...(value?{value}:{})});
  const first=analysis.visual.proposals[0],second=analysis.visual.proposals[1];
  assert.equal((await call(review(first,'publish'))).code,400);
  result=await call(review(first,'accepted'));assert.equal(result.code,200);assert.equal(result.body.analysis.visual.proposals[0].review.actor,'owner');
  assert.equal((await call(review(first,'rejected'))).code,400,'A final decision cannot be silently rewritten');
  result=await call(review(second,'edited','Owner corrected description'));assert.equal(result.code,200);
  assert.equal(result.body.analysis.visual.proposals[1].review.value,'Owner corrected description');
  const refreshed=await call();assert.equal(refreshed.body.analysis.visual.proposals[0].review.state,'accepted');assert.equal(refreshed.body.analysis.visual.proposals[1].review.state,'edited');assert.equal(calls,1);
  assert.deepEqual(await profile(),before,'Analysis/review never writes price, stock, authoring or publication');
  assert.equal(refreshed.body.analysis.publicationPermitted,false);
  const audit=await db.query("SELECT result FROM demeos_visual_execution_events WHERE result->>'status'='vendor-reviewed'");assert.equal(audit.rows.length,2);
  // Exact-result CAS prevents concurrent review writers from dropping a decision.
  const old=refreshed.body.analysis,assets=await repo.getSellingIntelligenceMedia('owner',businessId,before.products[0]),stock=await repo.getVendorInventory(businessId);
  assert.equal(await repo.saveSellingIntelligence('owner',before,before.products[0],assets,stock,{...old,review:{...old.review,status:'reviewed'}},old.inputHash,analysis),null);
  await repo.saveSellingProducts('owner',businessId,before,{...before,products:[{...before.products[0],description:'Changed after analysis'}]});
  assert.equal((await call(review(second,'rejected'))).code,409);
  corrupt=true;result=await call();assert.equal(result.body.analysis.visual.status,'failed');assert.equal(calls,1,'Corrupt bytes never reach the GPU transport');
  corrupt=false;await db.query("DELETE FROM demeos_selling_intelligence WHERE business_id=$1",[businessId]);wrongProvenance=true;
  result=await call();assert.equal(result.body.analysis.visual.status,'failed');assert.equal(result.body.analysis.model.available,false);assert.equal(calls,2);
 }finally{await db.close();}
});
