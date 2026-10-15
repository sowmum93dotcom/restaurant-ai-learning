'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {catalogueRevision}=require('../api/_lib/vendor-inventory');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database');
const {createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler,dataEnvironment,isolatedTestEnvironment}=require('../api/_lib/selling-dashboard');
const {resolveTrustedIdentityFromRequest}=require('../api/_lib/demeos-authentication');
const {sections,sectionForPath}=require('../js/selling-dashboard');
const {inspectCustomerPublication}=require('../api/_lib/customer-publication-rules');
const live={VERCEL_ENV:'production'},preview={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/selling-foundation-phase-1',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'rebuild/selling-foundation-phase-1',POSTGRES_URL:'postgresql://owner:fixture@isolated.example/neondb',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_SELLING_TEST_AUTHORIZATIONS:'[{"businessId":"test-business-selling-a","ownerIdentityId":"owner-a"}]'};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
test('test records require Preview, isolated data configuration and explicit business authorization',()=>{
 assert.equal(dataEnvironment('real-a',live),'live');
 assert.equal(dataEnvironment('real-a',preview),null);
 assert.equal(dataEnvironment('test-business-selling-a',preview,'owner-a'),'test');
 for(const env of [live,{...preview,VERCEL_ENV:'production'},{...preview,VERCEL_ENV:'development'},{...preview,DEMEOS_SELLING_TEST_AUTHORIZATIONS:'{}'},{...preview,DEMEOS_SELLING_TEST_AUTHORIZATIONS:'broken'},{...preview,DEMEOS_SELLING_DATA_ENVIRONMENT:'live'}])assert.equal(dataEnvironment('test-business-selling-a',env,'owner-a'),null);
 assert.equal(dataEnvironment('test-business-other',preview,'owner-a'),null);
 assert.equal(dataEnvironment('test-business-selling-a',preview,'owner-b'),null);
 for(const env of [{...preview,POSTGRES_URL:'postgresql://owner:fixture@production.example/neondb'},{...preview,VERCEL_GIT_COMMIT_REF:'another-preview'},{...preview,DEMEOS_SELLING_TEST_DATABASE_HOST:''},{...preview,POSTGRES_URL:''}])assert.equal(isolatedTestEnvironment(env),false);
 assert.equal(dataEnvironment('test-vendor-old',{...preview,DEMEOS_SELLING_TEST_AUTHORIZATIONS:'[{"businessId":"test-vendor-old","ownerIdentityId":"owner-a"}]'},'owner-a'),null);
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
test('authorized test-business namespace cannot publish genuine customer products or work',()=>{
 const row={business_id:'test-business-selling-a',campaign_id:'campaign-a',profile:{businessId:'test-business-selling-a',name:'Approved test shop',products:[]},campaign:{id:'campaign-a',businessId:'test-business-selling-a',campaignType:'social',approvalStatus:'Approved',campaignText:'Test product offer'}};
 const result=inspectCustomerPublication(row);assert.equal(result.eligible,false);assert.ok(result.reasons.includes('controlled_content_not_genuine'));
});
test('real SQL ownership, application grants, test isolation, revocation and response contract',async t=>{
 const db=new PGlite(),repository=createPersistenceRepository(createDatabase(db));
 const profile=(businessId,selling=true)=>({businessId,name:businessId,type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{marketing:true,selling},products:[]});
 try{
  await repository.createBusinessForOwner('owner-a',profile('real-a'));
  await repository.createBusinessForOwner('owner-a',profile('real-a-second'));
  await repository.createBusinessForOwner('owner-a',{...profile('test-business-selling-a',false),applicationAccess:undefined});
  await repository.createBusinessForOwner('owner-a',profile('test-business-not-allowlisted'));
  await repository.createBusinessForOwner('owner-a',profile('pending',false));
  await repository.createBusinessForOwner('owner-b',profile('real-b'));
  async function invoke({identity='owner-a',businessId,env=live,method='GET',repo=repository}={}){
   const handler=createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,repository:()=>repo,environment:()=>env});
   const res=response();await handler({method,query:{businessId,test:'1',role:'business-owner',ownerIdentityId:'owner-a'},headers:{'x-user-id':'owner-a','x-demeos-role':'demeos-admin','x-demeos-test':'true'},body:{businessId:'real-b',applicationAccess:{selling:true},test:true}},res);return res;
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
  await t.test('explicit test owner enters without real Selling approval using the same SQL ownership and contract',async()=>{
   const res=await invoke({env:preview});assert.equal(res.code,200);assert.equal(res.body.business.businessId,'test-business-selling-a');assert.equal(res.body.business.dataEnvironment,'test');
   assert.equal((await invoke({env:preview,identity:'owner-b',businessId:'test-business-selling-a'})).code,403);
   assert.equal((await invoke({env:preview,businessId:'test-business-not-allowlisted'})).code,403);
   assert.deepEqual(Object.keys(res.body.business).sort(),Object.keys((await invoke({businessId:'real-a'})).body.business).sort());
   assert.equal((await repository.getKnownBusiness('test-business-selling-a')).businessProfile.applicationAccess,undefined);
   const spoofed={...preview,DEMEOS_SELLING_TEST_AUTHORIZATIONS:'[{"businessId":"test-business-selling-a","ownerIdentityId":"unowned-identity"}]'};
   assert.equal((await invoke({env:spoofed,identity:'unowned-identity',businessId:'test-business-selling-a'})).code,403);
   await repository.assignBusinessOwner('owner-b','test-business-selling-a');
   assert.equal((await invoke({env:preview,identity:'owner-b',businessId:'test-business-selling-a'})).code,403,'Even a persisted co-owner needs an explicit test authorization');
   assert.equal((await invoke({env:{...preview,DEMEOS_SELLING_TEST_AUTHORIZATIONS:'[]'},businessId:'test-business-selling-a'})).code,403);
  });
  await t.test('empty membership, unsupported methods, invalid selection and repository errors are explicit',async()=>{
   assert.deepEqual((await invoke({identity:'new-owner'})).body.businesses,[]);
   assert.equal((await invoke({method:'PATCH'})).code,405);
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
test('test configuration fails closed before touching SQL when Preview isolation is not established',async()=>{
 for(const env of [{...preview,VERCEL_ENV:'production'},{...preview,POSTGRES_URL:'postgresql://owner:fixture@shared.example/neondb'},{...preview,VERCEL_GIT_COMMIT_REF:'unapproved-branch'}]){
  let opened=false;const res=response();
  await createHandler({authenticate:async()=>({trustedIdentityId:'owner-a'}),environment:()=>env,repository:()=>{opened=true;throw Error('Must not open shared records');}})({method:'GET',query:{businessId:'test-business-selling-a'}},res);
  assert.equal(res.code,503);assert.equal(opened,false);
 }
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

test('vendor product editor persists create edit and delete only for an owned approved business',async()=>{
 const profile={businessId:'real-a',name:'Real Shop',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:[]};
 let current=structuredClone(profile),writes=0;
 const repository={
   getVendorInventory:async()=>({revision:0,entries:{},history:[]}),
   getOwnedBusinessProfiles:async identity=>identity==='owner-a'?[current]:[],
   isBusinessOwnedByIdentity:async(identity,id)=>identity==='owner-a'&&id==='real-a',
   getKnownBusiness:async id=>id==='real-a'?{businessProfile:structuredClone(current)}:null,
   saveSellingProducts:async(identity,id,previous,next)=>{
     assert.equal(identity,'owner-a');assert.equal(id,'real-a');
     if(JSON.stringify(previous)!==JSON.stringify(current))return null;
     current=structuredClone(next);writes++;return current;
   }
 };
 async function call(identity,action,product){
   const handler=createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,repository:()=>repository,environment:()=>live});
   const res=response();await handler({method:'POST',query:{businessId:'real-a'},body:{action,product,catalogueRevision:catalogueRevision(current)}},res);return res;
 }
 const item={productId:'product-one',name:'Coffee',description:'Fresh coffee',priceMode:'fixed',price:'5'};
 assert.equal((await call('owner-b','save-product',item)).code,403);
 assert.equal((await call('owner-a','save-product',{...item,name:''})).code,400);
 assert.equal((await call('owner-a','save-product',item)).code,200);
 assert.equal(current.products[0].customerVisible,false);
 assert.equal((await call('owner-a','save-product',{...item,name:'Tea'})).code,200);
 assert.equal(current.products.length,1);assert.equal(current.products[0].name,'Tea');
 current.products[0].customerVisible=true;
 assert.equal((await call('owner-a','save-product',{...item,name:'Tea Updated'})).code,200);
 assert.equal(current.products[0].customerVisible,true,'Editing a published product must not silently unpublish it');
 assert.equal((await call('owner-a','delete-product',{productId:item.productId})).code,200);
 assert.equal(current.products.length,0);assert.equal(writes,4);
});

test('isolated Preview vendor can save products only in its authorized test business',async()=>{
 let current={businessId:'test-business-selling-a',name:'Test Shop',type:'Shop',location:'London',preparationModel:'selling',products:[]};
 let writes=0;
 const repository={
   getVendorInventory:async()=>({revision:0,entries:{},history:[]}),
   getOwnedBusinessProfiles:async id=>id==='owner-a'?[current]:[],
   isBusinessOwnedByIdentity:async(id,businessId)=>id==='owner-a'&&businessId===current.businessId,
   getKnownBusiness:async()=>({businessProfile:structuredClone(current)}),
   saveOwnedBusinessProfile:async(id,businessId,previous,next)=>{
     assert.equal(id,'owner-a');assert.equal(businessId,current.businessId);
     assert.deepEqual(previous,current);
     current=structuredClone(next);writes++;return true;
   }
 };
 async function call(env,identity){
   const handler=createHandler({authenticate:async()=>({trustedIdentityId:identity}),repository:()=>repository,environment:()=>env});
   const res=response();
   await handler({method:'POST',query:{businessId:'test-business-selling-a'},body:{catalogueRevision:catalogueRevision(current),action:'save-product',product:{productId:'product-a',name:'Coffee',description:'Coffee beans',priceMode:'contact',price:''}}},res);
   return res.code;
 }
 assert.equal(await call(preview,'owner-a'),200);
 assert.equal(writes,1);assert.equal(current.products.length,1);
 assert.equal(await call(preview,'owner-b'),403);
 assert.equal(await call(live,'owner-a'),403);
 assert.equal(writes,1);
});

test('product writes reject malformed requests, limits and concurrent edits',async()=>{
 const original={businessId:'real-a',name:'Real Shop',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:[]};
 let current=structuredClone(original),calls=0;
 const repository={
   getVendorInventory:async()=>({revision:0,entries:{},history:[]}),
   getOwnedBusinessProfiles:async()=>[current],
   isBusinessOwnedByIdentity:async()=>true,
   getKnownBusiness:async()=>({businessProfile:structuredClone(current)}),
   saveSellingProducts:async()=>{calls++;return null;}
 };
 async function invoke(action,product){
   const res=response();
   await createHandler({authenticate:async()=>({trustedIdentityId:'owner-a'}),repository:()=>repository,environment:()=>live})
    ({method:'POST',query:{businessId:'real-a'},body:{action,product,catalogueRevision:catalogueRevision(current)}},res);
   return res.code;
 }
 const valid={productId:'product-a',name:'Coffee',description:'Fresh coffee',priceMode:'fixed',price:'5'};
 assert.equal(await invoke('save-product',[]),400);
 assert.equal(await invoke('save-product',{...valid,productId:'bad/id'}),400);
 assert.equal(await invoke('save-product',{...valid,priceMode:'contact'}),400);
 assert.equal(await invoke('save-product',valid),409,'conflicting writes must not silently overwrite records');
 assert.equal(calls,1);
 current={...current,products:Array.from({length:100},(_,i)=>({...valid,productId:'item-'+i}))};
 assert.equal(await invoke('save-product',valid),409,'catalogue must enforce the maximum product count');
 assert.equal(calls,1);
 assert.equal(await invoke('delete-product',{productId:'missing'}),404);
});

test('stock ledger adjustments are atomic, audited, persistent and isolated for live and Preview owners',async()=>{
 const client=new PGlite();let env=live;
 const repository=createPersistenceRepository(createDatabase(client),{environment:()=>env});
 try{
  for(const [businessId,environment] of [['stock-live',live],['test-business-selling-a',preview]]){
   env=environment;
   const profile={businessId,name:'Stock Shop',applicationAccess:env===live?{selling:true}:undefined,products:[{businessId,productId:'coffee',name:'Coffee',stockQuantity:10,stockHistory:[{from:12,to:10,note:'Earlier count'}]}]};
   await repository.createBusinessForOwner('owner-a',profile);
   async function adjust(product,identity='owner-a',revision){
    const current=(await repository.getKnownBusiness(businessId)).businessProfile,stock=await repository.getVendorInventory(businessId),res=response();
    await createHandler({authenticate:async()=>({trustedIdentityId:identity}),repository:()=>repository,environment:()=>env})
     ({method:'POST',query:{businessId},body:{action:'adjust-stock',product,catalogueRevision:catalogueRevision(current),inventoryRevision:revision??stock.revision}},res);return res;
   }
   const change={productId:'coffee',quantity:12,note:'Delivery'};
   for(const quantity of [-1,1.5,1000000001])assert.equal((await adjust({...change,quantity})).code,400);
   assert.equal((await adjust({...change,note:''})).code,400);assert.equal((await adjust(change,'owner-b')).code,403);
   assert.equal((await adjust(change)).code,200);
   let stock=await repository.getVendorInventory(businessId);const key=JSON.stringify(['coffee','']);
   assert.equal(stock.entries[key].onHand,12);assert.equal(stock.history[0].changes[0].before,10);
   assert.equal(stock.history[0].trusted_identity_id,'owner-a');assert.equal(stock.history[0].changes[0].reason,'Delivery');
   assert.equal((await adjust({...change,quantity:9,note:'Damaged'},'owner-a',0)).code,409);
   assert.equal((await adjust({...change,quantity:9,note:'Damaged'})).code,200);
   stock=await repository.getVendorInventory(businessId);assert.equal(stock.entries[key].onHand,9);assert.equal(stock.history.length,2);
   assert.equal(stock.history[0].changes[0].before,12);assert.equal(stock.history[0].changes[0].after,9);
   assert.equal((await repository.getKnownBusiness(businessId)).businessProfile.products[0].stockHistory.length,1,'Earlier audit records retained');
   assert.equal((await adjust({...change,quantity:9})).code,400);
   if(env===preview){env=live;assert.equal((await adjust({...change,quantity:5})).code,403);assert.equal(await repository.saveVendorInventory('owner-a',businessId,(await repository.getKnownBusiness(businessId)).businessProfile,stock.revision,stock.entries,[]),null,'Production repository rejects Preview test grants');}
  }
 }finally{await client.close();}
});

test('selected vendor business exposes saved availability and stock history, not selector summaries',async()=>{
 const profile={businessId:'real-a',name:'Real Shop',type:'Shop',location:'London',preparationModel:'selling',
   applicationAccess:{selling:true},products:[{productId:'coffee',name:'Coffee',description:'Beans',priceMode:'contact',price:'',
     availability:'available',stockQuantity:9,stockHistory:[{from:12,to:9,note:'Damaged units',changedAt:'2026-10-15T00:00:00.000Z',changedBy:'owner-a'}]}]};
 const repository={
   getVendorInventory:async()=>({revision:0,entries:{},history:[]}),
   getOwnedBusinessProfiles:async()=>[profile],
   isBusinessOwnedByIdentity:async()=>true,
   getKnownBusiness:async()=>({businessProfile:profile})
 };
 const res=response();
 await createHandler({authenticate:async()=>({trustedIdentityId:'owner-a'}),repository:()=>repository,environment:()=>live})
  ({method:'GET',query:{businessId:'real-a'}},res);
 assert.equal(res.code,200);
 assert.equal(res.body.business.products[0].availability,'available');
 assert.equal(res.body.business.products[0].stockQuantity,9);
 assert.equal(res.body.business.products[0].stockHistory[0].note,'Damaged units');
 assert.equal(Object.hasOwn(res.body.businesses[0],'products'),false,'Business selector must not expose product data');
});

// Runs the same mutation contract against persisted live and Preview businesses.
test('variant CRUD, retries, stale revisions, preservation and isolation use real SQL',async()=>{
 const client=new PGlite(),repository=createPersistenceRepository(createDatabase(client));
 try{
  for(const [businessId,env] of [['real-variants',live],['test-business-selling-a',preview]]){
   const product={productId:'coffee',businessId,name:'Coffee',description:'Roasted beans',priceMode:'contact',price:'',mediaGallery:{assetIds:[],mainAssetId:''},stockQuantity:8,stockHistory:[{from:10,to:8,note:'Earlier count'}],presentation:{kind:'product',options:[],variants:[],extension:'keep'}};
   const profile={businessId,name:'Shop',applicationAccess:env===live?{selling:true}:undefined,products:[product]};
   await repository.createBusinessForOwner('owner-a',profile);
   async function call(action,item,identity='owner-a',revision){
    const current=(await repository.getKnownBusiness(businessId)).businessProfile;
    const res=response();await createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,repository:()=>repository,environment:()=>env})
     ({method:'POST',query:{businessId},body:{action,product:item,catalogueRevision:revision??catalogueRevision(current)}},res);return res;
   }
   const variant={productId:'coffee',variantId:'small-black',name:'Small / Black',sku:'SM-B',price:'4.50',availability:'available'};
   for(const invalid of [{...variant,variantId:'bad/id'},{...variant,productId:'missing'},{...variant,name:''},{...variant,price:'free'},{...variant,price:'-1'}])assert.ok([400,404].includes((await call('save-variant',invalid)).code));
   assert.equal((await call('save-variant',variant,'owner-b')).code,403);
   assert.equal((await call('save-variant',variant,null)).code,401);
   const stale=catalogueRevision((await repository.getKnownBusiness(businessId)).businessProfile);
   assert.equal((await call('save-variant',variant)).code,200);
   assert.equal((await call('save-variant',variant)).code,200,'Retry uses stable ID');
   let saved=(await repository.getKnownBusiness(businessId)).businessProfile.products[0];
   assert.equal(saved.variants.length,1);assert.equal(saved.variants[0].name,variant.name);
   assert.deepEqual(saved.presentation,product.presentation);assert.deepEqual(saved.mediaGallery,product.mediaGallery);
   assert.equal((await call('save-variant',{...variant,name:'Large'},'owner-a',stale)).code,409);
   assert.equal((await call('save-variant',{...variant,variantId:'duplicate',sku:'sm-b'})).code,400);
   assert.equal((await call('save-variant',{...variant,name:'Medium / Black',price:'5.00'})).code,200);
   saved=(await repository.getKnownBusiness(businessId)).businessProfile.products[0];assert.equal(saved.variants[0].name,'Medium / Black');
   assert.equal((await call('save-product',{productId:'coffee',name:'Fresh Coffee',description:'Fresh beans',priceMode:'contact',price:'',availability:'available'})).code,200);
   saved=(await repository.getKnownBusiness(businessId)).businessProfile.products[0];
   assert.equal(saved.variants[0].name,'Medium / Black');assert.equal(saved.stockQuantity,8);assert.equal(saved.stockHistory.length,1);
   assert.equal(Object.hasOwn(saved,'customerVisible'),false,'Unspecified publication flag remains unspecified');
   assert.equal((await call('delete-variant',variant)).code,200);
   saved=(await repository.getKnownBusiness(businessId)).businessProfile.products[0];assert.equal(saved.variants.length,0);assert.equal(saved.productId,'coffee');
   assert.equal((await call('delete-variant',variant)).code,404);
   if(env===preview){const res=response();await createHandler({authenticate:async()=>({trustedIdentityId:'owner-a'}),repository:()=>repository,environment:()=>live})({method:'POST',query:{businessId},body:{action:'save-variant',product:variant}},res);assert.equal(res.code,403);}
  }
 }finally{await client.close();}
});
