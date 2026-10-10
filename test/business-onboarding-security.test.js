'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database');
const persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
let identity=null,repository;
persistence.getRepository=()=>repository;
auth.resolveTrustedIdentityFromRequest=async()=>identity?{trustedIdentityId:identity}:null;
const handler=require('../api/businesses/[businessId]');
const facts={businessId:'isolated',name:'Isolated shop',type:'Clothing',location:'London',brandVoice:'Clear',targetCustomer:'Local customers',goal:'Share offers',profileVersion:4,productsServices:'Clothing',offeringCategoryId:'fashion.apparel',preparationModel:'both',customerContinuation:{routes:['website'],website:'https://example.org'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'contact'},products:[]};
async function invoke(businessId,body,method='PUT'){const response={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;},end(){return this;}};await handler({method,query:{businessId},body},response);return response;}
test('actual owner SQL/API preserves private preparation and snapshot submission boundaries',async()=>{
 const client=new PGlite(),repo=persistence.createPersistenceRepository(createDatabase(client));repository=repo;
 try{
  identity=null;assert.equal((await invoke('isolated',{businessProfile:facts})).statusCode,401);
  identity='owner-a';assert.equal((await invoke('isolated',{businessProfile:{...facts,name:''},ownerAccuracyConfirmed:true})).statusCode,400);assert.equal(await repo.getKnownBusiness('isolated'),null);
  for(const changes of [{offeringCategoryId:'invented.171'},{preparationModel:'merchant'}])assert.equal((await invoke('isolated',{businessProfile:{...facts,...changes},ownerAccuracyConfirmed:true})).statusCode,400);
  const creation=await invoke('isolated',{businessProfile:{...facts,selling:true,approvalStatus:'Approved',workspaceReadiness:{selling:{canSell:true}},informationStatus:{reviewState:'submitted',source:'admin'}},ownerAccuracyConfirmed:true});assert.equal(creation.statusCode,204);
  let saved=(await repo.getKnownBusiness('isolated')).businessProfile;assert.equal(saved.selling,undefined);assert.equal(saved.workspaceReadiness,undefined);assert.equal(saved.approvalStatus,undefined);assert.equal(saved.informationStatus.reviewState,undefined);
  identity='owner-b';assert.equal((await invoke('isolated',{},'GET')).statusCode,403);assert.equal((await invoke('isolated',{action:'submit-business',ownerAccuracyConfirmed:true,reviewedProfile:saved})).statusCode,403);assert.equal((await invoke('isolated',{businessProfile:facts,ownerAccuracyConfirmed:true})).statusCode,403);
  identity='owner-a';const body={action:'submit-business',ownerAccuracyConfirmed:true,reviewedProfile:saved};assert.equal((await invoke('isolated',{...body,ownerAccuracyConfirmed:false})).statusCode,409);assert.equal((await invoke('isolated',{...body,reviewedProfile:{...saved,name:'Stale'}})).statusCode,409);
  // Overlapping retries of the same snapshot must both succeed atomically.
  const concurrent=await Promise.all([repo.submitBusinessForReview('owner-a','isolated',saved),repo.submitBusinessForReview('owner-a','isolated',saved)]);
  assert.ok(concurrent.every(result=>result?.informationStatus.reviewState==='submitted'));assert.equal(concurrent[0].informationStatus.submittedAt,concurrent[1].informationStatus.submittedAt);
  const overlapping=await Promise.all([invoke('isolated',body),invoke('isolated',body)]);assert.ok(overlapping.every(result=>result.statusCode===200));
  assert.equal((await invoke('isolated',body)).statusCode,200);saved=(await repo.getKnownBusiness('isolated')).businessProfile;assert.equal(saved.informationStatus.reviewState,'submitted');const stamp=saved.informationStatus.submittedAt;assert.equal((await invoke('isolated',body)).statusCode,200);
  assert.equal((await invoke('isolated',{...body,reviewedProfile:saved})).statusCode,200);assert.equal((await repo.getKnownBusiness('isolated')).businessProfile.informationStatus.submittedAt,stamp);
  const readiness=(await invoke('isolated',{},'GET')).body.workspaceReadiness;assert.equal(readiness.onboarding.status,'submitted');assert.equal(readiness.onboarding.approved,false);assert.equal(readiness.selling.canSell,false);assert.equal(readiness.publication.draftsPublic,false);
  assert.equal((await invoke('isolated',{businessProfile:{...facts,name:'Revised shop'},ownerAccuracyConfirmed:true})).statusCode,204);let revised=(await repo.getKnownBusiness('isolated')).businessProfile;assert.equal(revised.offeringCategoryId,'fashion.apparel');assert.equal(revised.informationStatus.reviewState,'draft');assert.equal(revised.informationStatus.submittedAt,null);
  assert.equal(await repo.submitBusinessForReview('owner-a','isolated',saved),null);assert.equal(await repo.submitBusinessForReview('owner-b','isolated',revised),null);
  assert.equal((await invoke('isolated',{...body,reviewedProfile:saved})).statusCode,409);
  // Incomplete legacy records and ownership alone cannot submit an application.
  await repo.createBusinessForOwner('owner-a',{businessId:'incomplete',name:'Incomplete'});assert.equal((await invoke('incomplete',{action:'submit-business',ownerAccuracyConfirmed:true,reviewedProfile:{businessId:'incomplete',name:'Incomplete'}})).statusCode,409);
  assert.equal((await invoke('isolated',{action:'activate-selling'})).statusCode,400);
 }finally{await client.close();}
});
test('new onboarding guidance covers the existing nine-language registry',()=>{const {copy,keys}=require('../js/business-onboarding');const registry=require('../js/demeos-language-registry');assert.deepEqual(Object.keys(copy).sort(),registry.languages.map(l=>l.code).sort());for(const values of Object.values(copy)){assert.equal(values.length,keys.length);assert.ok(values.every(v=>typeof v==='string'&&v.trim()));}});
