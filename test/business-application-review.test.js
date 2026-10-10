'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite'),{createDatabase}=require('../api/_lib/database');
const persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
let identity=null,repository;
auth.resolveTrustedIdentityFromRequest=async()=>identity;persistence.getRepository=()=>repository;
const handler=require('../api/businesses'),ownerHandler=require('../api/businesses/[businessId]');
const {revision,ownerStatus}=require('../api/_lib/business-application-contract');
const profile={businessId:'application-a',profileVersion:4,name:'Private test shop',type:'Clothing',location:'London',productsServices:'Clothing',brandVoice:'Clear',targetCustomer:'Local customers',goal:'Show accurate offers',preparationModel:'both',offeringCategoryId:'fashion.apparel',customerContinuation:{routes:['website'],website:'https://example.org'},fulfilment:{methods:['shipping']},operationalAvailability:{status:'contact'},products:[],informationStatus:{source:'business-owner',status:'business-provided',ownerConfirmedAt:'2026-10-10T02:00:00.000Z',reviewState:'submitted',submittedAt:'2026-10-10T02:01:00.000Z'}};
async function invoke(query={},body={},method='GET',headers={host:'demeos.test'}){const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;},end(){return this;}};await handler({query:{resource:'admin-applications',...query},body,method,headers},res);return res;}
test('administrator review uses actual private owner registry and atomic append-only revision audit',async()=>{
 const client=new PGlite(),database=createDatabase(client);repository=persistence.createPersistenceRepository(database);
 try{
  await repository.createBusinessForOwner('owner-a',profile);await repository.createBusinessForOwner('owner-b',{...profile,businessId:'application-b',name:'Other private shop'});await repository.createBusinessForOwner('owner-a',{...profile,businessId:'draft',informationStatus:{...profile.informationStatus,reviewState:'draft'}});
  await repository.saveCampaign({id:'private-campaign',businessId:profile.businessId,campaignType:'social',campaignText:'Private draft',approvalStatus:'Unapproved'});
  for(const method of ['GET','POST']){identity=null;assert.equal((await invoke({businessId:profile.businessId},{actorScope:'demeos-admin',decision:'reviewed'},method,{'x-actor-scope':'demeos-admin',host:'demeos.test'})).statusCode,401);for(const scope of [undefined,'business-owner','customer']){identity={trustedIdentityId:'owner-a',actorScope:scope};assert.equal((await invoke({businessId:profile.businessId},{},method)).statusCode,403);}}
  identity={trustedIdentityId:'admin-a',actorScope:'demeos-admin'};
  const listed=await invoke();assert.equal(listed.statusCode,200);assert.match(listed.headers['Cache-Control'],/private, no-store/);assert.equal(listed.body.applications.length,2);assert.equal(listed.body.approvalAvailable,false);assert.equal(listed.body.applications[0].profile,undefined);
  const detail=await invoke({businessId:profile.businessId});assert.equal(detail.statusCode,200);assert.deepEqual(detail.body.owners,['owner-a']);assert.equal(detail.body.complete,true);assert.equal(detail.body.submitted,true);const body={revision:detail.body.revision,decision:'reviewed',notes:'Saved facts reviewed.'};
  assert.equal((await invoke({businessId:profile.businessId},{...body,decision:'approved'},'POST')).statusCode,409);assert.equal((await invoke({businessId:profile.businessId},{...body,administratorId:'attacker'},'POST')).statusCode,409);assert.equal((await invoke({businessId:profile.businessId},body,'POST',{origin:'https://attacker.test',host:'demeos.test'})).statusCode,403);
  assert.equal((await invoke({businessId:profile.businessId},body,'POST',{origin:'invalid',host:'demeos.test'})).statusCode,403);
  const parallel=await Promise.all([invoke({businessId:profile.businessId},body,'POST'),invoke({businessId:profile.businessId},body,'POST')]);assert.ok(parallel.every(r=>r.statusCode===200));assert.equal(parallel[0].body.review.decided_at.getTime(),parallel[1].body.review.decided_at.getTime());
  assert.equal((await invoke({businessId:profile.businessId},{...body,decision:'changes-requested'},'POST')).statusCode,409);identity={trustedIdentityId:'admin-b',actorScope:'demeos-admin'};assert.equal((await invoke({businessId:profile.businessId},body,'POST')).statusCode,409);
  let audit=(await database.query('SELECT * FROM demeos_business_application_reviews')).rows;assert.equal(audit.length,1);assert.equal(audit[0].administrator_id,'admin-a');assert.deepEqual(audit[0].reviewed_snapshot,profile);assert.equal(audit[0].application_revision,revision(profile));
  identity={trustedIdentityId:'owner-a'};
  const response={setHeader(){},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;},end(){}};
  await ownerHandler({method:'PUT',query:{businessId:profile.businessId},body:{businessProfile:{...profile,name:'Edited business',applicationReview:{status:'reviewed',approved:true},informationStatus:{reviewState:'reviewed',administratorId:'attacker'}},ownerAccuracyConfirmed:true}},response);assert.equal(response.statusCode,204);
  const saved=(await repository.getKnownBusiness(profile.businessId)).businessProfile;assert.equal(saved.applicationReview,undefined);assert.equal(saved.informationStatus.reviewState,'draft');assert.equal((await repository.getBusinessApplicationOwnerStatus(profile.businessId,saved)).status,'draft');
  identity={trustedIdentityId:'admin-a',actorScope:'demeos-admin'};assert.equal((await invoke({businessId:profile.businessId},body,'POST')).statusCode,409);
  assert.equal(await repository.recordBusinessApplicationReview({businessId:profile.businessId,profile,revision:revision(profile),administratorId:'admin-a',decision:'reviewed',notes:'Saved facts reviewed.'}),null);assert.equal((await database.query('SELECT * FROM demeos_business_application_reviews')).rows.length,1);
  const resubmitted=await repository.submitBusinessForReview('owner-a',profile.businessId,saved);assert.ok(resubmitted);const fresh=await invoke({businessId:profile.businessId});assert.notEqual(fresh.body.revision,body.revision);
  assert.equal((await invoke({businessId:profile.businessId},{revision:fresh.body.revision,decision:'changes-requested',notes:'Please clarify availability.'},'POST')).statusCode,200);
  const summary=await repository.getBusinessApplicationOwnerStatus(profile.businessId,resubmitted);assert.equal(summary.status,'changes-requested');assert.equal(summary.approved,false);assert.equal(summary.administrator_id,undefined);assert.equal(summary.notes,undefined);
  assert.deepEqual(await repository.getCustomerWork(),[]);assert.equal((await repository.getKnownBusiness(profile.businessId)).campaigns[0].approvalStatus,'Unapproved');
  for(const method of ['DELETE','PATCH'])assert.equal((await invoke({businessId:profile.businessId},body,method)).statusCode,405);
 }finally{await client.close();}
});
test('revision includes saved facts and submission metadata independent of JSON key ordering',()=>{assert.equal(revision(profile),revision(Object.fromEntries(Object.entries(profile).reverse())));assert.notEqual(revision(profile),revision({...profile,name:'Changed'}));assert.notEqual(revision(profile),revision({...profile,informationStatus:{...profile.informationStatus,submittedAt:'later'}}));assert.equal(ownerStatus(profile,{decision:'reviewed'}).approved,false);});
test('admin guidance reuses all nine existing languages without translating authoritative business facts',()=>{const {copy,keys}=require('../js/admin-business-review'),registry=require('../js/demeos-language-registry');assert.deepEqual(Object.keys(copy).sort(),registry.languages.map(l=>l.code).sort());for(const values of Object.values(copy)){assert.equal(values.length,keys.length);assert.ok(values.every(value=>value.trim()));}});

test('private review pagination, incomplete submissions and concurrent revisions preserve audit integrity',async()=>{
 const client=new PGlite(),database=createDatabase(client);repository=persistence.createPersistenceRepository(database);
 try{
  identity={trustedIdentityId:'admin-page',actorScope:'demeos-admin'};
  for(let i=0;i<28;i++)await repository.createBusinessForOwner('owner-page',{...profile,businessId:'page-'+String(i).padStart(2,'0')});
  const first=await invoke(),second=await invoke({cursor:first.body.nextCursor});assert.equal(first.body.applications.length,25);assert.equal(second.body.applications.length,3);assert.equal(second.body.nextCursor,null);assert.equal(new Set([...first.body.applications,...second.body.applications].map(r=>r.businessId)).size,28);
  const incomplete={...profile,businessId:'incomplete',preparationModel:''};await repository.createBusinessForOwner('owner-page',incomplete);let detail=await invoke({businessId:'incomplete'});assert.equal(detail.body.complete,false);assert.equal((await invoke({businessId:'incomplete'},{revision:detail.body.revision,decision:'reviewed',notes:''},'POST')).statusCode,409);
  await database.query('DELETE FROM demeos_business_owners WHERE business_id=$1',['page-01']);detail=await invoke({businessId:'page-01'});assert.equal(detail.body.complete,false);assert.equal((await invoke({businessId:'page-01'},{revision:detail.body.revision,decision:'reviewed',notes:''},'POST')).statusCode,409);
  const id='page-00',before=(await repository.getKnownBusiness(id)).businessProfile,changed={...before,name:'Concurrent revision',informationStatus:{...before.informationStatus,reviewState:'draft',submittedAt:null}};
  const [decision]=await Promise.all([repository.recordBusinessApplicationReview({businessId:id,profile:before,revision:revision(before),administratorId:'admin-page',decision:'reviewed',notes:''}),repository.saveBusiness(changed)]);
  const rows=(await database.query('SELECT * FROM demeos_business_application_reviews WHERE business_id=$1',[id])).rows;assert.equal(rows.length,decision?1:0);if(rows.length){assert.deepEqual(rows[0].reviewed_snapshot,before);assert.equal(rows[0].application_revision,revision(before));}
  assert.equal((await repository.getBusinessApplicationOwnerStatus(id,changed)).status,'draft');assert.equal((await repository.getBusinessApplicationOwnerStatus(id,changed)).approved,false);
 }finally{await client.close();}
});

test('administrative continuation presentation preserves every supported route detail',()=>{
 const {continuationText}=require('../js/admin-business-review');
 const saved={routes:['website','phone','whatsapp','email','booking','visit','quote'],website:'https://example.org',phone:'+442012345678',whatsapp:'+442098765432',email:'owner@example.org',bookingLink:'https://example.org/appointments',visitAddress:'Exact saved customer address'};
 const text=continuationText(saved);for(const key of ['website','phone','whatsapp','email','bookingLink','visitAddress'])assert.ok(text.includes(saved[key]));assert.equal(text.split('\n').length,7);assert.equal(continuationText(null),'');assert.equal(continuationText({routes:'invalid'}),'');assert.equal(continuationText({...saved,routes:['website']}),'website · https://example.org');
});
