'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler,dataEnvironment}=require('../api/_lib/selling-dashboard');
const {resolveTrustedIdentityFromRequest}=require('../api/_lib/demeos-authentication');
const {sections,sectionForPath}=require('../js/selling-dashboard');
const live={VERCEL_ENV:'production'},preview={VERCEL_ENV:'preview',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_BUSINESS_IDS:'["test-business-selling-a"]'};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
test('test records require Preview, isolated data configuration and explicit business authorization',()=>{
 assert.equal(dataEnvironment('real-a',live),'live');
 assert.equal(dataEnvironment('real-a',preview),null);
 assert.equal(dataEnvironment('test-business-selling-a',preview),'test');
 for(const env of [live,{...preview,VERCEL_ENV:'production'},{...preview,VERCEL_ENV:'development'},{...preview,DEMEOS_SELLING_TEST_BUSINESS_IDS:'{}'},{...preview,DEMEOS_SELLING_TEST_BUSINESS_IDS:'broken'},{...preview,DEMEOS_SELLING_DATA_ENVIRONMENT:'live'}])assert.equal(dataEnvironment('test-business-selling-a',env),null);
 assert.equal(dataEnvironment('test-business-other',preview),null);
 assert.equal(dataEnvironment('test-vendor-old',{...preview,DEMEOS_SELLING_TEST_BUSINESS_IDS:'["test-vendor-old"]'}),null);
});
test('all seven sections resolve on refresh and direct paths, retired routes do not',()=>{
 assert.equal(Object.keys(sections).length,7);
 for(const section of Object.keys(sections))assert.equal(sectionForPath('/selling-vendor/'+section),section);
 assert.equal(sectionForPath('/selling-vendor'),'overview');
 for(const path of ['/selling-vendor/manage','/selling-vendor/inspect','/selling-vendor/onboarding','/selling-vendor/unknown'])assert.equal(sectionForPath(path),null);
 const rewrites=require('../vercel.json').rewrites;
 assert.ok(rewrites.find(r=>r.source==='/selling-vendor'&&r.destination==='/selling-dashboard.html'));
 const sectionRoute=rewrites.find(r=>r.source.startsWith('/selling-vendor/:section'));
 for(const section of Object.keys(sections))assert.ok(sectionRoute.source.includes(section));
});
test('real SQL ownership, application grants, test isolation, revocation and response contract',async t=>{
 const db=new PGlite(),repository=createPersistenceRepository(createDatabase(db));
 const profile=(businessId,selling=true)=>({businessId,name:businessId,type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{marketing:true,selling},products:[]});
 try{
  await repository.createBusinessForOwner('owner-a',profile('real-a'));
  await repository.createBusinessForOwner('owner-a',profile('real-a-second'));
  await repository.createBusinessForOwner('owner-a',profile('test-business-selling-a'));
  await repository.createBusinessForOwner('owner-a',profile('test-business-not-allowlisted'));
  await repository.createBusinessForOwner('owner-a',profile('pending',false));
  await repository.createBusinessForOwner('owner-b',profile('real-b'));
  async function invoke({identity='owner-a',businessId,env=live,method='GET',repo=repository}={}){
   const handler=createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,repository:()=>repo,environment:()=>env});
   const res=response();await handler({method,query:{businessId},headers:{'x-user-id':'owner-b'},body:{businessId:'real-b',applicationAccess:{selling:true}}},res);return res;
  }
  await t.test('authorized real owner sees only approved owned live summaries, no products or orders',async()=>{
   const res=await invoke();assert.equal(res.code,200);assert.deepEqual(res.body.businesses.map(b=>b.businessId),['real-a','real-a-second']);assert.equal(res.body.business,null);
   assert.equal(res.headers['Cache-Control'],'private, no-store');assert.equal(res.headers['Vercel-CDN-Cache-Control'],'no-store');
   assert.deepEqual(Object.keys(res.body.businesses[0]).sort(),['businessId','dataEnvironment','location','name','type']);
   assert.equal((await invoke({businessId:'real-a'})).body.business.businessId,'real-a');
  });
  await t.test('unauthenticated and cross-owner access is denied despite spoofed request claims',async()=>{
   assert.equal((await invoke({identity:null,businessId:'real-a'})).code,401);
   for(const businessId of ['real-b','pending','missing','test-business-selling-a']){const res=await invoke({businessId});assert.equal(res.code,403);assert.equal(res.body.business,undefined);}
  });
  await t.test('explicit test business uses same SQL ownership, grants and contract in isolated Preview',async()=>{
   const res=await invoke({env:preview});assert.equal(res.code,200);assert.equal(res.body.business.businessId,'test-business-selling-a');assert.equal(res.body.business.dataEnvironment,'test');
   assert.equal((await invoke({env:preview,identity:'owner-b',businessId:'test-business-selling-a'})).code,403);
   assert.equal((await invoke({env:preview,businessId:'test-business-not-allowlisted'})).code,403);
   assert.deepEqual(Object.keys(res.body.business).sort(),Object.keys((await invoke({businessId:'real-a'})).body.business).sort());
  });
  await t.test('empty membership, unsupported methods, invalid selection and repository errors are explicit',async()=>{
   assert.deepEqual((await invoke({identity:'new-owner'})).body.businesses,[]);
   assert.equal((await invoke({method:'POST'})).code,405);
   assert.equal((await invoke({businessId:['real-a']})).code,400);
   assert.equal((await invoke({repo:{getOwnedBusinessProfiles(){throw Error('private SQL details');}}})).code,503);
  });
  await t.test('revoked Selling grant closes an existing owner session',async()=>{
   await repository.saveBusiness(profile('real-a',false));assert.equal((await invoke({businessId:'real-a'})).code,403);
  });
  await t.test('grant and ownership are rechecked after the list is read',async()=>{
   const repo={...repository,getOwnedBusinessProfiles:async()=>[profile('race')],isBusinessOwnedByIdentity:async()=>false};
   assert.equal((await invoke({businessId:'race',repo})).code,403);
   repo.isBusinessOwnedByIdentity=async()=>true;repo.getKnownBusiness=async()=>({businessProfile:profile('race',false)});
   assert.equal((await invoke({businessId:'race',repo})).code,403);
  });
 }finally{await db.close();}
});
test('dashboard authentication consumes the existing verified Clerk request boundary',async()=>{
 const before={...process.env};process.env.CLERK_SECRET_KEY='sk_test_fixture';process.env.CLERK_PUBLISHABLE_KEY='pk_test_fixture';process.env.VERCEL_ENV='preview';
 try{
  let verified=false;
  const handler=createHandler({authenticate:req=>resolveTrustedIdentityFromRequest(req,{authenticateRequest:async request=>{assert.equal(request.headers.get('authorization'),'Bearer signed-session');return {isAuthenticated:verified,toAuth:()=>({userId:'verified-owner'})};}}),repository:()=>({getOwnedBusinessProfiles:async id=>{assert.equal(id,'verified-owner');return [];}})});
  const req={method:'GET',url:'/api/businesses?resource=selling-dashboard',query:{},headers:{host:'demeos.test',authorization:'Bearer signed-session','x-user-id':'spoofed-owner'}};
  const denied=response();await handler(req,denied);assert.equal(denied.code,401);
  verified=true;const allowed=response();await handler(req,allowed);assert.equal(allowed.code,200);assert.equal(allowed.body.vendor.identityId,'verified-owner');
 }finally{for(const key of ['CLERK_SECRET_KEY','CLERK_PUBLISHABLE_KEY','VERCEL_ENV']){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
