'use strict';
// Dependency fixtures test permission composition, not GPU execution.
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createHandler}=require('../api/_lib/root-intelligence'),{catalogueRevision}=require('../api/_lib/vendor-inventory');
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'root',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'root',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',POSTGRES_URL:'postgresql://fixture:fixture@isolated.example/isolated',DEMEOS_SELLING_TEST_AUTHORIZATIONS:'[{"businessId":"test-business-root","ownerIdentityId":"alice"}]',DEMEOS_ROOT_PERSISTENCE_ENABLED:'true',DEMEOS_ROOT_PREVIEW_OWNER_IDS:'["alice"]',DEMEOS_ROOT_VISUAL_PREVIEW_ENABLED:'true'};
test('ROOT visual delegation requires independent ROOT and Selling grants, consent, revision and successful executor',async()=>{
 const product={businessId:'test-business-root',productId:'p',name:'On-Demand Groceries',description:'Carrots',classification:{categoryId:'9',sectorId:'1'}};
 const profile={businessId:product.businessId,name:'Isolated fixture',products:[product]};let executions=0,saves=0,owned=true,succeed=true;
 const repository={isBusinessOwnedByIdentity:async(id,business)=>owned&&id==='alice'&&business===profile.businessId,getKnownBusiness:async()=>({businessProfile:profile}),getSellingIntelligenceMedia:async()=>[]};
 const body={action:'visual-selling',audience:'business',confirmed:true,saveConfirmed:true,requestId:randomUUID(),locale:'en',businessId:profile.businessId,productId:'p',revision:catalogueRevision(product)};
 async function call(patch={},config=env,identity='alice'){
  const response={setHeader(){},status(code){this.code=code;return this;},json(data){this.body=data;return this;}};
  const handler=createHandler({environment:()=>config,authenticate:async()=>({trustedIdentityId:identity}),repository:()=>repository,workStore:()=>({save:async(i,w,id,result)=>{saves++;return {status:'saved',work:{work_id:randomUUID(),result}};}}),visualRunnerFactory:()=>({analyze:async()=>{executions++;return succeed?{status:'succeeded',provenance:{modelId:'explicit-fixture-not-real-inference',modelVersion:'fixture'},proposals:[{kind:'image-description',value:'Fixture carrots'}]}:{status:'unavailable'};}})});
  await handler({method:'POST',headers:{'content-type':'application/json'},body:{...body,...patch}},response);return response;
 }
 for(const patch of [{confirmed:false},{saveConfirmed:false},{audience:'customer'},{requestId:'invalid'},{businessId:'foreign'},{revision:'stale'},{endpoint:'https://untrusted.example'}])assert.notEqual((await call(patch)).code,201);
 assert.equal((await call({},env,'bob')).code,503);assert.equal((await call({},{...env,DEMEOS_ROOT_VISUAL_PREVIEW_ENABLED:'false'})).code,503);assert.equal((await call({},{...env,VERCEL_ENV:'production'})).code,503);assert.equal(executions,0);assert.equal(saves,0);
 const valid=await call();assert.equal(valid.code,201);assert.equal(executions,1);assert.equal(saves,1);assert.equal(valid.body.result.engine.modelExecuted,true);assert.equal(valid.body.result.visual.proposals[0].value,'Fixture carrots');assert.equal(valid.body.result.source.kind,'explicit-selling-share');
 succeed=false;assert.equal((await call()).code,503);assert.equal(saves,1,'unavailable runtime must not save a fabricated model success');owned=false;assert.equal((await call()).code,403);assert.equal(executions,2);
});
