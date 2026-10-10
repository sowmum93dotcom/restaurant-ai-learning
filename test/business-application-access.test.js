'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
const {applicationAccess}=require('../api/_lib/business-application-access');
const {workspaceReadiness}=require('../api/_lib/business-workspace-readiness');
const {createDatabase}=require('../api/_lib/database'),persistence=require('../api/_lib/persistence'),auth=require('../api/_lib/demeos-authentication');
test('application authority is exact, explicit and independent of owner model intent',()=>{
 for(const preparationModel of ['marketing','selling','both']) {
  const record={businessProfile:{businessId:'owned',preparationModel,selling:true,approved:true}};
  assert.deepEqual(applicationAccess(record,'owned'),{marketing:false,selling:false});
  assert.equal(workspaceReadiness(record,'owned').selling.canSell,false);
  record.businessProfile.applicationAccess={marketing:true,selling:'true'};
  assert.deepEqual(applicationAccess(record,'owned'),{marketing:true,selling:false});
  assert.deepEqual(applicationAccess(record,'foreign'),{marketing:false,selling:false});
 }
});
test('shared SQL identity enforces separate application access, private evidence and protected profile revisions',async()=>{
 const client=new PGlite(),db=createDatabase(client),repo=persistence.createPersistenceRepository(db);
 const originalRepository=persistence.getRepository,originalIdentity=auth.resolveTrustedIdentityFromRequest;
 persistence.getRepository=()=>repo;auth.resolveTrustedIdentityFromRequest=async req=>req.identity?{trustedIdentityId:req.identity}:null;
 const modules=['../api/_lib/demeos-business-owner-authorization','../api/businesses/[businessId]','../api/businesses/[businessId]/orders','../api/businesses/[businessId]/inventory','../api/businesses/[businessId]/products','../api/businesses/[businessId]/media/index'];
 for(const m of modules)delete require.cache[require.resolve(m)];
 const [authorization,business,orders,inventory,products,media]=modules.map(m=>require(m));
 const profile={businessId:'owned',name:'Private business',type:'Goods',location:'London',brandVoice:'Clear',targetCustomer:'Customers',goal:'Prepare',preparationModel:'both',products:[],profileVersion:1};
 const call=async(handler,identity='owner',method='GET',body={},query={businessId:'owned'})=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;},end(){return this;}};await handler({identity,method,body,query},res);return res;};
 try {
  await db.ensureSchema();await repo.createBusinessForOwner('owner',profile);
  const privateCampaign={id:'private-campaign',businessId:'owned',approvalStatus:'Unapproved',promoText:'Confidential draft'};
  await db.query('INSERT INTO demeos_campaigns(campaign_id,business_id,campaign) VALUES($1,$2,$3::jsonb)',['private-campaign','owned',JSON.stringify(privateCampaign)]);
  assert.equal((await call(business,null)).code,401);assert.equal((await call(business,'foreign')).code,403);
  for(const grants of [{marketing:true,selling:false},{marketing:false,selling:true},{marketing:true,selling:true},{marketing:false,selling:false}]) {
   await repo.saveBusiness({...profile,applicationAccess:grants});
   for(const application of ['marketing','selling'])assert.equal((await call(business,'owner','GET',{}, {businessId:'owned',application})).code,grants[application]?200:403);
   const record=(await call(business)).data;assert.deepEqual(record.workspaceReadiness.applications,grants);
   assert.equal(record.campaigns.length,grants.marketing?1:0);
   assert.equal((await call(orders)).code,grants.selling?200:403);
   assert.equal((await call(inventory)).code,grants.selling?200:403);
   assert.equal((await call(products)).code,grants.selling?409:403);
   const permitted=await authorization.authorizeBusinessOwnerRequest({req:{identity:'owner'},businessId:'owned',action:'create-marketing',repository:repo});assert.equal(permitted.allowed,grants.marketing);
   const submitted={...profile,preparationModel:'both',applicationAccess:{marketing:true,selling:true}};
   assert.equal((await call(business,'owner','PUT',{businessProfile:submitted})).code,204);
   assert.deepEqual((await repo.getKnownBusiness('owned')).businessProfile.applicationAccess,grants);
  }
  await repo.saveBusiness({...profile,applicationAccess:{marketing:false,selling:true}});
  await repo.saveBusinessMediaAsset('owned',{assetId:'campaign-media',businessId:'owned',purpose:'marketing',kind:'image',state:'ready'});
  await repo.saveBusinessMediaAsset('owned',{assetId:'product-media',businessId:'owned',purpose:'product',kind:'image',state:'ready'});
  assert.deepEqual((await call(media)).data.assets.map(a=>a.assetId),['product-media']);
  assert.equal((await call(media,'owner','GET',{}, {businessId:'owned',application:'marketing'})).code,403);
  await repo.saveBusiness({...profile,applicationAccess:{marketing:true,selling:true}});
  assert.deepEqual((await call(media,'owner','GET',{}, {businessId:'owned',application:'selling'})).data.assets.map(a=>a.assetId),['product-media']);
  assert.equal((await call(media,'owner','GET',{}, {businessId:'owned',application:'marketing'})).data.assets.length,2);
  assert.deepEqual((await call(business,'owner','GET',{}, {businessId:'owned',application:'selling'})).data.campaigns,[]);
  await repo.saveBusiness({...profile,applicationAccess:{marketing:false,selling:true}});
  assert.equal((await call(media,'owner','POST',{asset:{purpose:'marketing'}})).code,403);
  const before=(await repo.getKnownBusiness('owned')).businessProfile;
  await repo.saveBusiness({...before,applicationAccess:{marketing:false,selling:false}});
  assert.equal(await repo.saveOwnedBusinessProfile('owner','owned',before,{...before,name:'Stale edit'}),false);
  assert.equal(await repo.saveVendorInventory('owner','owned',before,0,{},[]),null);
  assert.equal((await db.query('SELECT COUNT(*)::integer AS count FROM demeos_businesses')).rows[0].count,1);
  assert.equal((await db.query('SELECT campaign FROM demeos_campaigns WHERE campaign_id=$1',['private-campaign'])).rows[0].campaign.approvalStatus,'Unapproved');
 } finally {
  persistence.getRepository=originalRepository;auth.resolveTrustedIdentityFromRequest=originalIdentity;
  for(const m of modules)delete require.cache[require.resolve(m)];await client.close();
 }
});
