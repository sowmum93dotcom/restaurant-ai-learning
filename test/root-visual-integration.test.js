'use strict';
// Dependency fixtures test permission composition, not GPU execution.
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createHandler}=require('../api/_lib/root-intelligence'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'root',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'root',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',POSTGRES_URL:'postgresql://fixture:fixture@isolated.example/isolated',DEMEOS_SELLING_TEST_AUTHORIZATIONS:'[{"businessId":"test-business-root","ownerIdentityId":"alice"}]',DEMEOS_ROOT_PERSISTENCE_ENABLED:'true',DEMEOS_ROOT_PREVIEW_OWNER_IDS:'["alice"]',DEMEOS_ROOT_VISUAL_PREVIEW_ENABLED:'true'};
test('ROOT visual delegation requires independent ROOT and Selling grants, consent, revision and successful executor',async()=>{
 const product={businessId:'test-business-root',productId:'p',name:'On-Demand Groceries',description:'Carrots',classification:{categoryId:'9',sectorId:'1'}};
 const profile={businessId:product.businessId,name:'Isolated fixture',products:[product]};let executions=0,saves=0,owned=true,succeed=true,revokeDuringExecution=false;
 const repository={isBusinessOwnedByIdentity:async(id,business)=>owned&&id==='alice'&&business===profile.businessId,getKnownBusiness:async()=>({businessProfile:profile}),getSellingIntelligenceMedia:async()=>[],getSellingVisualScope:async(id,business,p)=>owned&&id==='alice'&&business===profile.businessId&&p===product.productId?{businessProfile:profile,assets:[]}:null};
 const body={action:'visual-selling',audience:'business',confirmed:true,saveConfirmed:true,requestId:randomUUID(),locale:'en',businessId:profile.businessId,productId:'p',revision:catalogueRevision(product)};
 async function call(patch={},config=env,identity='alice'){
  const response={setHeader(){},status(code){this.code=code;return this;},json(data){this.body=data;return this;}};
  const handler=createHandler({environment:()=>config,authenticate:async()=>({trustedIdentityId:identity}),repository:()=>repository,workStore:()=>({save:async(i,w,id,result)=>{saves++;return {status:'saved',work:{work_id:randomUUID(),result}};}}),visualRunnerFactory:()=>({analyze:async()=>{executions++;if(revokeDuringExecution)owned=false;return succeed?{status:'succeeded',provenance:{modelId:'explicit-fixture-not-real-inference',modelVersion:'fixture'},proposals:[{kind:'image-description',value:'Fixture carrots'}]}:{status:'unavailable'};}})});
  await handler({method:'POST',headers:{'content-type':'application/json'},body:{...body,...patch}},response);return response;
 }
 for(const patch of [{confirmed:false},{saveConfirmed:false},{audience:'customer'},{requestId:'invalid'},{businessId:'foreign'},{revision:'stale'},{endpoint:'https://untrusted.example'}])assert.notEqual((await call(patch)).code,201);
 assert.equal((await call({},env,'bob')).code,503);assert.equal((await call({},{...env,DEMEOS_ROOT_VISUAL_PREVIEW_ENABLED:'false'})).code,503);assert.equal((await call({},{...env,VERCEL_ENV:'production'})).code,503);assert.equal(executions,0);assert.equal(saves,0);
 const valid=await call();assert.equal(valid.code,201);assert.equal(executions,1);assert.equal(saves,1);assert.equal(valid.body.result.engine.modelExecuted,true);assert.equal(valid.body.result.visual.proposals[0].value,'Fixture carrots');assert.equal(valid.body.result.source.kind,'explicit-selling-share');
 succeed=false;assert.equal((await call()).code,503);assert.equal(saves,1,'unavailable runtime must not save a fabricated model success');owned=false;assert.equal((await call()).code,403);assert.equal(executions,2);
 owned=true;succeed=true;revokeDuringExecution=true;assert.equal((await call()).code,403);assert.equal(saves,1,'A fresh post-execution snapshot must reject a revoked owner before saving');
});

test('ROOT visual result traverses real SQL save, reload and review without crossing personal contexts',async()=>{
 // Only the executor is a named fixture. This proves persistence composition,
 // not actual native model quality, GPU transport or deployed acceptance.
 const {PGlite}=require('@electric-sql/pglite');
 const {createDatabase}=require('../api/_lib/database');
 const {SCHEMA,createStore}=require('../api/_lib/root-work-store');
 const db=new PGlite(),database=createDatabase(db),store=createStore(database);
 try{
  for(const statement of SCHEMA)await database.query(statement);
  const product={businessId:'test-business-root',productId:'p',name:'On-Demand Groceries',description:'Carrots',classification:{categoryId:'9',sectorId:'1'}};
  const profile={businessId:product.businessId,name:'SQL integration fixture',products:[product]};
  const repository={isBusinessOwnedByIdentity:async identity=>identity==='alice',getKnownBusiness:async()=>({businessProfile:profile}),getSellingIntelligenceMedia:async()=>[],getSellingVisualScope:async identity=>identity==='alice'?{businessProfile:profile,assets:[]}:null};
  let available=true,suggestion='Unverified fixture carrots';
  const config={...env,DEMEOS_ROOT_PREVIEW_OWNER_IDS:'["alice","bob"]'};
  async function call(body,identity='alice',audience='business'){
   const handler=createHandler({environment:()=>config,authenticate:async()=>({trustedIdentityId:identity}),repository:()=>repository,workStore:()=>store,visualRunnerFactory:()=>({analyze:async()=>available?{status:'succeeded',provenance:{modelId:'sql-fixture-not-gpu',modelVersion:'fixture'},proposals:[{kind:'image-description',value:suggestion}]}:{status:'unavailable'}})});
   const res={setHeader(){},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
   await handler({method:body?'POST':'GET',query:{audience},headers:{'content-type':'application/json'},body},res);return res;
  }
  const request={action:'visual-selling',audience:'business',confirmed:true,saveConfirmed:true,requestId:randomUUID(),locale:'en',businessId:profile.businessId,productId:'p',revision:catalogueRevision(product)};
  const saved=await call(request);assert.equal(saved.code,201);
  const work=saved.body.work;assert.equal(work.result.engine.modelExecuted,true);assert.equal(work.review_state,'pending');
  const original=JSON.parse(JSON.stringify(work.result));
  suggestion='Different fixture interpretation';assert.equal((await call(request)).code,409,'a reused save key cannot substitute a changed native result');suggestion='Unverified fixture carrots';
  let history=(await call()).body.history.works;
  assert.equal(history.length,1);assert.deepEqual(history[0].result,original);
  assert.equal((await call(undefined,'alice','customer')).body.history.works.length,0);
  assert.equal((await call(undefined,'bob')).body.history.works.length,0);
  const review={action:'review-work',audience:'business',confirmed:true,workId:work.work_id,revision:work.revision,decision:'accepted'};
  assert.equal((await call(review,'bob')).code,403);
  assert.equal((await call({...review,audience:'customer'})).code,403);
  let updated=(await call(review)).body.work;assert.equal(updated.review_state,'accepted');
  assert.equal((await call(review)).code,409,'stale review cannot overwrite a newer decision');
  updated=(await call({...review,revision:updated.revision,decision:'corrected',text:'Owner correction: carrots, condition unknown'})).body.work;
  assert.equal(updated.reviewed_text,'Owner correction: carrots, condition unknown');
  history=(await call()).body.history.works;assert.equal(history[0].reviewed_text,updated.reviewed_text);assert.deepEqual(history[0].result,original);
  updated=(await call({...review,revision:updated.revision,decision:'rejected'})).body.work;
  assert.equal(updated.review_state,'rejected');assert.deepEqual(updated.result,original);
  available=false;assert.equal((await call({...request,requestId:randomUUID()})).code,503);
  assert.equal((await call()).body.history.works.length,1,'failed execution creates no saved success');
  const audit=await database.query('SELECT action FROM demeos_root_audit ORDER BY revision');
  assert.deepEqual(audit.rows.map(row=>row.action),['saved','accepted','corrected','rejected']);
 }finally{await db.close();}
});
