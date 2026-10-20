'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard'),{catalogueRevision,stockIdentity}=require('../api/_lib/vendor-inventory');
const sales=require('../api/_lib/selling-sales-channels');
const wholesale={method:'direct',currency:'GBP',unitPrice:'8.50',minimumQuantity:12,packSize:6,tiers:[{minimumQuantity:24,unitPrice:'8.00'},{minimumQuantity:60,unitPrice:'7.50'}]};
test('wholesale estimates apply whole-pack thresholds and exact currency arithmetic without a fabricated quote price',()=>{
 assert.deepEqual(sales.estimate(wholesale,12),{quantity:12,packs:2,currency:'GBP',status:'calculated',unitPrice:'8.50',subtotal:'102.00',subtotalMinor:'10200',saving:'0.00',appliedMinimumQuantity:12});
 for(const [quantity,unit,subtotal,saving,threshold] of [[18,'8.50','153.00','0.00',12],[24,'8.00','192.00','12.00',24],[54,'8.00','432.00','27.00',24],[60,'7.50','450.00','60.00',60]]){const result=sales.estimate(wholesale,quantity);assert.equal(result.unitPrice,unit);assert.equal(result.subtotal,subtotal);assert.equal(result.saving,saving);assert.equal(result.appliedMinimumQuantity,threshold);}
 for(const quantity of [0,6,13,1.5,'24',null,NaN,Infinity,1000002,Number.MAX_SAFE_INTEGER])assert.throws(()=>sales.estimate(wholesale,quantity));
 assert.equal(sales.estimate({...wholesale,minimumQuantity:1,packSize:1,unitPrice:'0.10',tiers:[]},3).subtotal,'0.30');
 assert.equal(sales.estimate({...wholesale,currency:'JPY',unitPrice:'8',tiers:[]},12).subtotal,'96');
 const big=sales.estimate({...wholesale,currency:'KWD',minimumQuantity:1,packSize:1,unitPrice:'999999999.999',tiers:[]},1000000);assert.equal(big.subtotal,'999999999999000.000');assert.equal(big.subtotalMinor,'999999999999000000');
 assert.deepEqual(sales.estimate({...wholesale,method:'quote',unitPrice:'',tiers:[]},12),{quantity:12,packs:2,currency:'GBP',status:'quote-required'});
});
test('wholesale pricing requires a signed-in owner before loading any business data',async()=>{
 const handler=createHandler({authenticate:async()=>null,repository:()=>{throw Error('Unauthorized data read');}});
 const headers={},res={setHeader(k,v){headers[k]=v;},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
 await handler({method:'POST',query:{businessId:'channel-shop'},body:{action:'estimate-wholesale',product:{productId:'tea',quantity:24}}},res);
 assert.equal(res.code,401);assert.equal(headers['Cache-Control'],'private, no-store');assert.equal(headers['Vercel-CDN-Cache-Control'],'no-store');
});
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
  const beforeEstimate=JSON.stringify(saved),beforeStock=await repo.getVendorInventory(businessId),beforeOrders=await repo.getVendorOrders(identity,businessId);
  const estimateBody={action:'estimate-wholesale',catalogueRevision:catalogueRevision(saved),product:{productId:product.productId,quantity:24}};
  const estimate=await call('POST',estimateBody);assert.equal(estimate.code,200);assert.equal(estimate.body.estimate.subtotal,'192.00');assert.equal(estimate.body.catalogueRevision,estimateBody.catalogueRevision);
  assert.equal((await call('POST',estimateBody,{},'another-owner')).code,403);
  assert.equal((await call('POST',{...estimateBody,catalogueRevision:'stale'})).code,409);
  for(const change of [{quantity:13},{quantity:'24'},{quantity:6},{quantity:1000002},{currency:'USD'},{unitPrice:'0.01'},{businessTerms:{...wholesale,unitPrice:'0.01'}},{variantId:'unpriced-variant'}])assert.equal((await call('POST',{...estimateBody,product:{...estimateBody.product,...change}})).code,400);
  assert.equal((await call('POST',{...estimateBody,product:{productId:'missing',quantity:24}})).code,404);
  assert.equal(JSON.stringify(await profile()),beforeEstimate,'Calculating cannot change catalogue or publication');assert.deepEqual(await repo.getVendorInventory(businessId),beforeStock,'Calculating cannot reserve or adjust stock');assert.deepEqual(await repo.getVendorOrders(identity,businessId),beforeOrders,'Calculating cannot create an order');
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
  assert.equal((await call('POST',{...estimateBody,catalogueRevision:catalogueRevision(await profile())})).code,400,'Consumer-only terms cannot be priced as wholesale');
  assert.equal((await save({...product,salesChannel:'both',businessTerms:{...wholesale,method:'quote',unitPrice:'',tiers:[]}})).code,200);
  const quoted=await call('POST',{...estimateBody,catalogueRevision:catalogueRevision(await profile())});assert.equal(quoted.code,200);assert.equal(quoted.body.estimate.status,'quote-required');assert.equal(quoted.body.estimate.subtotal,undefined);
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
 const copy=require('../js/selling-dashboard-copy');for(const lang of copy.languages)for(const key of ['Sales channel','B2C · Individual customers','B2B · Business buyers','Both · B2B and B2C','Business terms · B2B','Channel not recorded','Check the sales channels, currency, quantities and wholesale prices.','Wholesale price calculator','Quantity in units','Calculate saved price','Uses saved product terms. Tax, delivery, variant pricing and stock availability are not included. No order is created.','Calculating saved terms…','Enter at least the minimum quantity, in whole packs.','A quote is required. No fixed price is saved.','Packs','Product subtotal','Quantity discount saving'])assert.ok(copy.packs[lang.code][key],lang.code+': '+key);
 const orders=require('../api/_lib/selling-order-page');assert.equal(orders.parse().channel,'');assert.equal(orders.parse({orderChannel:'unrecorded'}).channel,'unrecorded');assert.throws(()=>orders.parse({orderChannel:'both'}));
});
