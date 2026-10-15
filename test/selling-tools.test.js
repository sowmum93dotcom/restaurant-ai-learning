'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createDatabase}=require('../api/_lib/database'),{createPersistenceRepository}=require('../api/_lib/persistence');
const {createHandler}=require('../api/_lib/selling-dashboard'),inventory=require('../api/_lib/vendor-inventory');
const {createVendorOrders}=require('../api/_lib/vendor-orders');
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('permitted business edits, structured variants, genuine overview/orders and reservation protections use SQL',async()=>{
 const client=new PGlite(),db=createDatabase(client);let env;
 const repository=createPersistenceRepository(db,{environment:()=>env});
 try{
  for(const preview of [false,true]){
   const businessId=preview?'test-business-tools':'live-tools';
   env=preview?{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/selling-foundation-phase-1',DEMEOS_SELLING_DATA_ENVIRONMENT:'test',DEMEOS_SELLING_TEST_PREVIEW_BRANCH:'rebuild/selling-foundation-phase-1',POSTGRES_URL:'postgres://fixture@isolated.example/db',DEMEOS_SELLING_TEST_DATABASE_HOST:'isolated.example',DEMEOS_SELLING_TEST_AUTHORIZATIONS:JSON.stringify([{businessId,ownerIdentityId:'owner-a'}])}:{VERCEL_ENV:'production'};
   const product={businessId,productId:'shirt',name:'Shirt',description:'Cotton shirt',price:'20',priceMode:'fixed',availability:'available',customerVisible:true,presentation:{version:1,categoryId:'fashion.apparel',pricing:{mode:'fixed',currency:'GBP',amount:20},options:[{key:'size',values:[{value:'M',label:'Medium'}]}],variants:[{variantId:'medium',selection:{size:'M'},availability:'available',pricing:{mode:'fixed',currency:'GBP',amount:21.5},extension:'keep'}]}};
   const profile={businessId,name:'Registered Shop',type:'Shop',location:'London',preparationModel:'selling',productsServices:'Clothing',informationStatus:{reviewState:'approved'},applicationAccess:{selling:true,marketing:true},products:[product]};
   await repository.createBusinessForOwner('owner-a',profile);
   let saved=(await repository.getKnownBusiness(businessId)).businessProfile;
   const update=inventory.applyChanges(saved,{},[{productId:'shirt',variantId:'medium',onHand:5,lowStock:1,sku:'M',reason:'Initial count'}]);
   await repository.saveVendorInventory('owner-a',businessId,saved,0,update.entries,update.audit);
   // Exercise the existing reservation service in an isolated fixture. No production purchase policy changes.
   const orders=createVendorOrders(db,{authorizePurchase:()=>true});
   let order;
   const reserve=()=> orders.reserve('fixture-customer','request-tools-'+(preview?'preview':'live'),{businessId,productId:'shirt',variantId:'medium',selection:{size:'M'},quantity:2,catalogueRevision:inventory.catalogueRevision(saved),stockIdentity:inventory.stockIdentity(product,product.presentation.variants[0])});
   if(preview)await assert.rejects(reserve(),error=>error.reason==='controlled-record');else order=await reserve();
   if(preview){await repository.saveBusiness({...saved,applicationAccess:undefined});saved=(await repository.getKnownBusiness(businessId)).businessProfile;}
   async function call(body,identity='owner-a',method='POST'){
    const current=(await repository.getKnownBusiness(businessId)).businessProfile,res=response();
    await createHandler({authenticate:async()=>identity?{trustedIdentityId:identity}:null,environment:()=>env,repository:()=>repository})({method,query:{businessId},body:{catalogueRevision:inventory.catalogueRevision(current),...body}},res);return res;
   }
   let context=(await call({},'owner-a','GET')).body.business;
   assert.deepEqual(context.summary,{products:1,availableProducts:1,variants:1,trackedStockRows:1,recentOrders:preview?0:1});
   if(order){assert.equal(context.orders[0].id,order.id);assert.equal(context.orders[0].line.totalPriceMinor,4300);assert.equal(context.orders[0].customerId,undefined);}else assert.deepEqual(context.orders,[],'Controlled test records cannot fabricate real orders');
   assert.equal((await call({},'owner-b','GET')).code,403);assert.deepEqual(await repository.getVendorOrders('owner-b',businessId),[]);
   const details={name:'Updated Shop',location:'Greenwich, London',productsServices:'Independent clothing shop'};
   assert.equal((await call({action:'save-business-details',details,ownerAccuracyConfirmed:false})).code,400);
   assert.equal((await call({action:'save-business-details',details:{...details,applicationAccess:{selling:true}},ownerAccuracyConfirmed:true})).code,400);
   assert.equal((await call({action:'save-business-details',details,ownerAccuracyConfirmed:true},'owner-b')).code,403);
   const revision=inventory.catalogueRevision(saved);
   assert.equal((await call({action:'save-business-details',details,ownerAccuracyConfirmed:true})).code,200);
   assert.equal((await call({action:'save-business-details',details,ownerAccuracyConfirmed:true,catalogueRevision:revision})).code,409);
   saved=(await repository.getKnownBusiness(businessId)).businessProfile;assert.equal(saved.name,details.name);assert.equal(saved.informationStatus.reviewState,'draft');assert.deepEqual(saved.applicationAccess,preview?undefined:profile.applicationAccess);assert.deepEqual(saved.products,[product]);
   const variant={productId:'shirt',variantId:'medium',name:'Medium / Navy',sku:'NAVY-M',price:'7.50',availability:'limited'};
   assert.equal((await call({action:'save-variant',product:variant})).code,200);
   saved=(await repository.getKnownBusiness(businessId)).businessProfile;
   assert.deepEqual(saved.products[0].presentation.variants[0].selection,{size:'M'});assert.equal(saved.products[0].presentation.variants[0].extension,'keep');assert.equal(saved.products[0].presentation.variants[0].pricing.amount,7.5);assert.equal(saved.products[0].presentation.pricing.amount,20);
   context=(await call({},'owner-a','GET')).body.business;assert.equal(context.products[0].variants[0].name,variant.name);
   assert.equal((await call({action:'save-product',product:{productId:'shirt',name:'Repriced Shirt',description:'Cotton shirt',price:'23',priceMode:'fixed',availability:'available'}})).code,200);
   saved=(await repository.getKnownBusiness(businessId)).businessProfile;
   assert.equal(saved.products[0].presentation.pricing.amount,23);assert.equal(saved.products[0].presentation.variants[0].pricing.amount,7.5);
   assert.deepEqual(saved.products[0].presentation.options,product.presentation.options);assert.equal(saved.products[0].customerVisible,true);

   if(!preview)assert.equal((await call({action:'delete-variant',product:variant})).code,409,'Cannot remove reserved variant');
   if(!preview)assert.equal((await call({action:'delete-product',product:{productId:'shirt'}})).code,409,'Cannot remove reserved product');
   const stock=await repository.getVendorInventory(businessId);
   if(!preview)assert.equal((await call({action:'adjust-stock',inventoryRevision:stock.revision,product:{productId:'shirt',variantId:'medium',quantity:1,note:'Below reservations'}})).code,400);
   assert.equal((await call({action:'update-order',orderId:order?.id||'missing',state:'fulfilled'})).code,400,'No invented vendor fulfillment transition');
   if(order)await orders.release(order.id,'cancelled','fixture-customer');
   assert.equal((await call({action:'delete-variant',product:variant})).code,200);
   saved=(await repository.getKnownBusiness(businessId)).businessProfile;assert.equal(saved.products.length,1);assert.equal(saved.products[0].presentation.variants.length,0);
   assert.equal((await call({action:'save-variant',product:variant})).code,409,'Do not attach earlier stock history to a replacement variant');

   await repository.saveBusinessMediaAsset(businessId,{businessId,assetId:'pending-'+businessId,kind:'image',state:'pending-upload',purpose:'product',relatedEntityId:'shirt'});
   assert.equal((await call({action:'delete-product',product:{productId:'shirt'}})).code,200);
   assert.equal((await repository.getBusinessMediaAsset(businessId,'pending-'+businessId)).state,'archived','No active orphan media after product deletion');
   if(order)assert.equal((await call({},'owner-a','GET')).body.business.orders[0].state,'cancelled','Order history survives product deletion');
   if(preview){env={VERCEL_ENV:'production'};assert.equal((await call({},'owner-a','GET')).code,403);assert.deepEqual(await repository.getVendorOrders('owner-a',businessId),[]);}
  }
 }finally{await client.close();}
});
