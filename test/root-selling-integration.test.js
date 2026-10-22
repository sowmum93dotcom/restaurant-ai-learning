'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/root-intelligence');
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'root-test',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'root-test',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',POSTGRES_URL:'postgresql://fixture:fixture@isolated.example/isolated',DEMEOS_SELLING_TEST_AUTHORIZATIONS:JSON.stringify([{businessId:'test-business-root-a',ownerIdentityId:'alice'},{businessId:'test-business-root-b',ownerIdentityId:'bob'}])};
async function invoke(repository,body,identity='alice',environment=env){const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await createHandler({repository:()=>repository,authenticate:async()=>({trustedIdentityId:identity}),environment:()=>environment})({method:'POST',headers:{'content-type':'application/json'},body},res);return res;}
test('ROOT optional Selling sharing uses real SQL ownership, exact source revision and no writeback',async()=>{
 const db=new PGlite(),repository=createPersistenceRepository(createDatabase(db));
 try{
  const profile=id=>({businessId:id,name:id,type:'Shop',location:'London',products:[{productId:'groceries',name:'Groceries',description:'Apples and carrots',classification:{categoryId:'9',sectorId:'1'}}]});
  await repository.createBusinessForOwner('alice',profile('test-business-root-a'));await repository.createBusinessForOwner('bob',profile('test-business-root-b'));
  const before=await repository.getKnownBusiness('test-business-root-a');
  const listing=await invoke(repository,{action:'selling-options',audience:'business',confirmed:true});assert.equal(listing.code,200);assert.equal(listing.body.products.length,1);assert.equal(listing.body.products[0].businessId,'test-business-root-a');
  const selected=listing.body.products[0],body={action:'understand-selling',audience:'business',confirmed:true,businessId:selected.businessId,productId:selected.productId,revision:selected.revision,locale:'de'};
  const result=await invoke(repository,body);assert.equal(result.code,200);assert.equal(result.body.result.source.kind,'explicit-selling-share');assert.equal(result.body.result.engine.modelExecuted,false);assert.equal(result.body.result.locale,'de');
  assert.deepEqual(await repository.getKnownBusiness('test-business-root-a'),before,'analysis must not edit catalogue, grant or submission data');
  assert.equal((await invoke(repository,body,'bob')).code,403);assert.equal((await invoke(repository,{...body,businessId:'test-business-root-b'})).code,403);assert.equal((await invoke(repository,{...body,revision:'stale'})).code,409);
  assert.equal((await invoke(repository,{...body,confirmed:false})).code,403);assert.equal((await invoke(repository,{...body,audience:'customer'})).code,403);assert.equal((await invoke(repository,{...body,role:'demeos-admin'})).code,400);
  assert.equal((await invoke(repository,body,'alice',{...env,DEMEOS_SELLING_TEST_AUTHORIZATIONS:'[]'})).code,403);
  const changed={...repository,getKnownBusiness:async id=>{const result=await repository.getKnownBusiness(id);return {...result,businessProfile:{...result.businessProfile,products:[]}};}};assert.equal((await invoke(changed,body)).code,403);
  const revoked={...repository,isBusinessOwnedByIdentity:async()=>false};assert.equal((await invoke(revoked,body)).code,403);
 }finally{await db.close();}
});
test('unreviewed or misconfigured Preview cannot touch integration SQL; standalone ROOT does not load SQL',async()=>{
 let calls=0;const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 const handler=createHandler({repository:()=>{calls++;throw Error('must not connect');},authenticate:async()=>({trustedIdentityId:'not-a-vendor'}),environment:()=>({VERCEL_ENV:'preview'})});
 await handler({method:'GET',query:{audience:'customer'}},res);assert.equal(res.code,200);assert.equal(calls,0);
 await handler({method:'POST',headers:{'content-type':'application/json'},body:{action:'selling-options',audience:'business',confirmed:true}},res);assert.equal(res.code,503);assert.equal(calls,0);
});
