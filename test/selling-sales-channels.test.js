'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard'),{catalogueRevision,stockIdentity}=require('../api/_lib/vendor-inventory');
const sales=require('../api/_lib/selling-sales-channels');
const wholesale={method:'direct',currency:'GBP',unitPrice:'8.50',minimumQuantity:12,packSize:6,tiers:[{minimumQuantity:24,unitPrice:'8.00'},{minimumQuantity:60,unitPrice:'7.50'}]};
test('wholesale terms reject contradictory discounts, invalid packs, invented currencies and currency precision',()=>{
 assert.deepEqual(sales.businessTerms(wholesale),wholesale);
 for(const change of [{currency:'ZZZ'},{currency:'JPY'},{minimumQuantity:13},{packSize:0},{minimumQuantity:1.5},{unitPrice:'-1'},{unitPrice:'1e3'},{tiers:[{minimumQuantity:12,unitPrice:'7'}]},{tiers:[{minimumQuantity:25,unitPrice:'7'}]},{tiers:[{minimumQuantity:24,unitPrice:'9'}]},{method:'quote'},{buyerVerified:true}])assert.throws(()=>sales.businessTerms({...wholesale,...change}));
 assert.equal(sales.businessTerms({...wholesale,currency:'KWD',unitPrice:'8.123',tiers:[]}).unitPrice,'8.123');
 assert.deepEqual(sales.businessTerms({...wholesale,method:'quote',unitPrice:'',tiers:[]}).tiers,[]);
});
test('sales settings persist in real SQL with ownership, revisions, channel filtering and one shared stock identity',async()=>{
 const client=new PGlite(),repo=createPersistenceRepository(createDatabase(client));
 const businessId='channel-shop',identity='channel-owner';
 try{
  await repo.createBusinessForOwner(identity,{businessId,name:'Channel shop',type:'Shop',location:'London',preparationModel:'selling',applicationAccess:{selling:true},products:[]});
  const profile=async()=>(await repo.getKnownBusiness(businessId)).businessProfile;
  const handler=createHandler({authenticate:async req=>({trustedIdentityId:req.identity||identity}),repository:()=>repo,environment:()=>({VERCEL_ENV:'production'})});
  async function call(method,body={},query={},actor=identity){const res={setHeader(){},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};await handler({method,body,identity:actor,query:{businessId,view:'catalogue',...query}},res);return res;}
  const product={productId:'shared-stock-product',name:'Boxed tea',description:'Retail or wholesale tea',price:'12',priceMode:'fixed',availability:'contact',salesChannel:'both',businessTerms:wholesale};
  const save=async(item,actor=identity)=>(call('POST',{action:'save-product',catalogueRevision:catalogueRevision(await profile()),product:item},{},actor));
  assert.equal((await save(product)).code,400,'Product cannot enable a channel outside business settings');
  const details={name:'Channel shop',salesChannel:'both',businessAddress:{countryCode:'GB',addressLine1:'10 Market Street',locality:'London'},serviceArea:'',productsServices:'Tea',customerContinuation:{email:'',phone:'',website:''}};
  const businessBody={action:'save-business-details',catalogueRevision:catalogueRevision(await profile()),details,ownerAccuracyConfirmed:true};
  assert.equal((await call('POST',businessBody,{},'another-owner')).code,403);
  assert.equal((await call('POST',businessBody)).code,200);
  assert.equal((await call('POST',businessBody)).code,409,'Business changes are revision guarded');
  assert.equal((await save(product,'another-owner')).code,403);
  assert.equal((await save(product)).code,200);
  let saved=await profile(),p=saved.products[0];const originalStockIdentity=stockIdentity(p);
  assert.equal(p.salesChannel,'both');assert.deepEqual(p.businessTerms,wholesale);assert.equal(p.customerVisible,false);assert.deepEqual(saved.applicationAccess,{selling:true});
  for(const channel of ['b2c','b2b']){const page=await call('GET',{}, {channel});assert.equal(page.body.business.products.length,1);assert.deepEqual(page.body.business.products[0].businessTerms,wholesale);}
  const bad=await call('POST',{...businessBody,catalogueRevision:catalogueRevision(saved),details:{...details,salesChannel:'b2b'}});assert.equal(bad.code,400,'Cannot strand a both-channel product in a B2B-only business');
  assert.equal((await save({...product,salesChannel:'b2b'})).code,200);
  saved=await profile();p=saved.products[0];assert.equal(stockIdentity(p),originalStockIdentity,'Channel terms do not duplicate or reset shared inventory');
  assert.equal((await call('GET',{}, {channel:'b2c'})).body.business.cataloguePage.total,0);
  assert.equal((await call('GET',{}, {channel:'b2b'})).body.business.cataloguePage.total,1);
  assert.equal((await call('GET',{}, {channel:'both'})).code,400,'Filters accept only defined buyer channels');
  assert.equal((await save({...product,salesChannel:'both',businessTerms:{...wholesale,tiers:[{minimumQuantity:24,unitPrice:'10'}]}})).code,400);
  assert.equal((await profile()).products[0].salesChannel,'b2b','Rejected terms cannot partially change a product');
  assert.equal((await save({...product,salesChannel:'b2c'})).code,200);
  assert.equal((await profile()).products[0].businessTerms,undefined,'Returning to retail removes obsolete wholesale terms');
 }finally{await client.close();}
});
test('consumer publication excludes B2B-only records and never leaks wholesale prices from both-channel products',()=>{
 const {toPublicCustomerWorkItem}=require('../api/_lib/customer-public-work-contract');
 const product={businessId:'shop',productId:'tea',name:'Tea',description:'Fresh tea',price:'12',continuationRoute:'website',availability:'available',salesChannel:'both',businessTerms:wholesale};
 const raw={businessId:'shop',workItemId:'campaign',businessName:'Shop',content:'Tea',participationAction:'Interested',salesChannel:'both',customerContinuation:{routes:['website'],website:'https://example.test'},products:[product]};
 const consumer=toPublicCustomerWorkItem(raw);assert.equal(consumer.products.length,1);assert.equal(consumer.products[0].price,'12');assert.equal(JSON.stringify(consumer).includes('businessTerms'),false);assert.equal(JSON.stringify(consumer).includes('8.50'),false);
 assert.equal(toPublicCustomerWorkItem({...raw,products:[{...product,salesChannel:'b2b'}]}).products,undefined);
 assert.equal(toPublicCustomerWorkItem({...raw,salesChannel:'b2b'}).products,undefined);
 assert.equal(toPublicCustomerWorkItem({...raw,products:[{...product,salesChannel:'invalid'}]}).products,undefined);
});
test('the consumer reservation route fails closed for B2B-only products before reading stock',()=>{
 const {resolveLine}=require('../api/_lib/vendor-orders');
 for(const setting of ['b2b','invalid']){const profile={businessId:'shop',salesChannel:'both',products:[{businessId:'shop',productId:'tea',salesChannel:setting}]};assert.throws(()=>resolveLine(profile,{productId:'tea',catalogueRevision:catalogueRevision(profile)},{}),error=>error.reason==='sales-channel-unavailable');}
});
test('sales channel copy and private order filters cover all established locales without assigning historical buyer type',()=>{
 const copy=require('../js/selling-dashboard-copy');for(const lang of copy.languages)for(const key of ['Sales channel','B2C · Individual customers','B2B · Business buyers','Both · B2B and B2C','Business terms · B2B','Channel not recorded','Check the sales channels, currency, quantities and wholesale prices.'])assert.ok(copy.packs[lang.code][key],lang.code+': '+key);
 const orders=require('../api/_lib/selling-order-page');assert.equal(orders.parse().channel,'');assert.equal(orders.parse({orderChannel:'unrecorded'}).channel,'unrecorded');assert.throws(()=>orders.parse({orderChannel:'both'}));
});
